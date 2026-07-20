const db = require('../config/database');
const { isWithinCampus } = require('../utils/geoUtils');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Mark attendance
 * POST /api/attendance/mark
 */
async function markAttendance(req, res, next) {
  try {
    const studentId = req.user.id;
    const { latitude, longitude, face_match_score, session } = req.body;

    // 1. Verify student is approved and biometric-registered
    const [studentRows] = await db.query(
      'SELECT id, status, biometric_registered FROM students WHERE id = ?',
      [studentId]
    );
    const student = studentRows[0];
    if (!student || student.status !== 'approved') {
      return errorResponse(res, 'Your account is not approved for attendance.', 403);
    }
    if (!student.biometric_registered) {
      return errorResponse(res, 'Please complete biometric registration before marking attendance.', 403);
    }

    // 2. Check geo-fencing
    const [geoRows] = await db.query(
      'SELECT latitude, longitude, radius_meters FROM geo_fencing_settings WHERE is_active = TRUE LIMIT 1'
    );
    if (!geoRows.length) {
      return errorResponse(res, 'Geo-fencing settings not configured. Please contact admin.', 500);
    }
    const geo = geoRows[0];
    const { isWithin, distance } = isWithinCampus(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(geo.latitude),
      parseFloat(geo.longitude),
      geo.radius_meters
    );

    if (!isWithin) {
      await db.query(
        `INSERT INTO attendance_logs (student_id, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)`,
        [studentId, 'LOCATION_REJECTED', JSON.stringify({ distance, allowed: geo.radius_meters }), req.ip, req.headers['user-agent']]
      );
      return errorResponse(
        res,
        `Attendance rejected. You are ${distance}m away from campus (allowed: ${geo.radius_meters}m).`,
        403
      );
    }

    // 3. Determine and validate session timings from database
    const today = new Date().toISOString().split('T')[0];
    const sessionLabel = session || 'Morning';

    const [settingsRows] = await db.query(
      'SELECT start_time, end_time, grace_minutes, is_active FROM attendance_settings WHERE session_name = ?',
      [sessionLabel]
    );
    const sessionSettings = settingsRows[0];
    if (!sessionSettings || !sessionSettings.is_active) {
      return errorResponse(res, `The ${sessionLabel} session is not active or not configured.`, 400);
    }

    // Compare current time with session bounds (including grace period)
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    const currentTotalSeconds = currentHours * 3600 + currentMinutes * 60 + currentSeconds;

    const [startH, startM, startS] = sessionSettings.start_time.split(':').map(Number);
    const startTotalSeconds = startH * 3600 + startM * 60 + (startS || 0);

    const [endH, endM, endS] = sessionSettings.end_time.split(':').map(Number);
    const endTotalSeconds = endH * 3600 + endM * 60 + (endS || 0) + (sessionSettings.grace_minutes * 60);

    if (currentTotalSeconds < startTotalSeconds || currentTotalSeconds > endTotalSeconds) {
      return errorResponse(
        res,
        `Attendance for ${sessionLabel} session can only be marked between ${sessionSettings.start_time.substring(0, 5)} and ${sessionSettings.end_time.substring(0, 5)} (including a ${sessionSettings.grace_minutes}-min grace period).`,
        403
      );
    }

    // Check duplicate attendance for today
    const [dupRows] = await db.query(
      'SELECT id FROM attendance WHERE student_id = ? AND attendance_date = ? AND session = ?',
      [studentId, today, sessionLabel]
    );
    if (dupRows.length > 0) {
      return errorResponse(res, 'Attendance already marked for this session today.', 409);
    }

    // 4. Validate face match score
    const matchScore = parseFloat(face_match_score) || 0;
    const FACE_THRESHOLD = 60; // 60% minimum similarity
    if (matchScore < FACE_THRESHOLD) {
      await db.query(
        `INSERT INTO attendance_logs (student_id, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)`,
        [studentId, 'FACE_REJECTED', JSON.stringify({ score: matchScore }), req.ip, req.headers['user-agent']]
      );
      return errorResponse(
        res,
        `Face verification failed. Similarity score: ${matchScore.toFixed(1)}%. Minimum required: ${FACE_THRESHOLD}%.`,
        403
      );
    }

    // 5. Mark attendance
    const statusVal = sessionLabel.toLowerCase() === 'afternoon' ? 'halfday' : 'present';
    await db.query(
      `INSERT INTO attendance
       (student_id, attendance_date, status, marked_at, verified_by_face, verified_by_location,
        face_match_score, latitude, longitude, device_info, ip_address, session)
       VALUES (?, ?, ?, NOW(), TRUE, TRUE, ?, ?, ?, ?, ?, ?)`,
      [studentId, today, statusVal, matchScore, latitude, longitude, JSON.stringify({ userAgent: req.headers['user-agent'] || 'Unknown' }), req.ip, sessionLabel]
    );

    // 6. Log success
    await db.query(
      `INSERT INTO attendance_logs (student_id, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)`,
      [studentId, 'ATTENDANCE_MARKED', JSON.stringify({ date: today, session: sessionLabel, score: matchScore }), req.ip, req.headers['user-agent']]
    );

    return successResponse(res, {
      date: today,
      session: sessionLabel,
      face_match_score: matchScore,
      distance_from_campus: distance,
    }, 'Attendance marked successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get student attendance history
 * GET /api/attendance/history
 */
async function getAttendanceHistory(req, res, next) {
  try {
    const studentId = req.user.id;
    const { month, year } = req.query;

    let sql = `
      SELECT a.attendance_date, a.status, a.session, a.marked_at,
             a.verified_by_face, a.verified_by_location, a.face_match_score
      FROM attendance a
      WHERE a.student_id = ?
    `;
    const params = [studentId];

    if (month && year) {
      sql += ' AND EXTRACT(MONTH FROM a.attendance_date) = ? AND EXTRACT(YEAR FROM a.attendance_date) = ?';
      params.push(parseInt(month), parseInt(year));
    }

    sql += ' ORDER BY a.attendance_date DESC';

    const [rows] = await db.query(sql, params);
    return successResponse(res, rows, 'Attendance history fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get attendance statistics for student
 * GET /api/attendance/stats
 */
async function getAttendanceStats(req, res, next) {
  try {
    const studentId = req.user.id;

    // Get working days config
    const [wdRows] = await db.query(
      'SELECT * FROM working_days WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1'
    );

    // Get total present days (present = 1.0, halfday = 0.5), grouped and capped at 1.0 per calendar day
    const [presentRows] = await db.query(
      `SELECT COALESCE(SUM(daily_present), 0) AS present FROM (
         SELECT attendance_date, LEAST(1.0, SUM(CASE WHEN status::text = 'present' THEN 1.0 WHEN status::text IN ('halfday', 'half_day') THEN 0.5 ELSE 0 END)) AS daily_present
         FROM attendance
         WHERE student_id = ?
         GROUP BY attendance_date
       ) AS t`,
      [studentId]
    );

    // Get total leave days (approved)
    const [leaveRows] = await db.query(
      `SELECT COALESCE(SUM((to_date - from_date) + 1), 0) AS leave_days
       FROM leave_requests
       WHERE student_id = ? AND status = 'approved'`,
      [studentId]
    );

    // Get total holidays in semester
    const [holidayRows] = await db.query(
      `SELECT COALESCE(SUM((to_date - from_date) + 1), 0) AS holidays FROM holidays WHERE academic_year = ?`,
      [wdRows[0]?.academic_year || '2024-25']
    );

    const present = Number(presentRows[0].present || 0);
    const leaveDays = parseInt(leaveRows[0].leave_days) || 0;
    const holidays = parseInt(holidayRows[0].holidays) || 0;

    // Calculate total working days from semester dates
    let totalWorkingDays = 0;
    if (wdRows.length) {
      const wd = wdRows[0];
      const start = new Date(wd.semester_start);
      const end = new Date(wd.semester_end);
      const workingDays = typeof wd.working_days_json === 'string'
        ? JSON.parse(wd.working_days_json || '[]')
        : (wd.working_days_json || []);
      const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (workingDays.includes(dayNames[d.getDay()])) {
          totalWorkingDays++;
        }
      }
      totalWorkingDays -= holidays;
    }

    const absent = Math.max(0, totalWorkingDays - present - leaveDays);
    const percentage = totalWorkingDays > 0 ? Math.round((present / totalWorkingDays) * 100) : 0;

    return successResponse(res, {
      present,
      absent,
      leave_days: leaveDays,
      holidays,
      total_working_days: totalWorkingDays,
      attendance_percentage: percentage,
    }, 'Attendance statistics fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get all students attendance for a date (Staff/Admin)
 * GET /api/attendance/department
 */
async function getDepartmentAttendance(req, res, next) {
  try {
    const { department_id, date, year, semester } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Subquery: aggregate all sessions per student for the target date into one consolidated status
    let sql = `
      SELECT s.id, s.name, s.student_id, s.year, s.semester, s.branch, d.name AS department,
             COALESCE(agg.status, 'absent') AS status,
             agg.marked_at, agg.face_match_score, agg.verified_by_face, agg.verified_by_location
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN (
        SELECT
          student_id,
          CASE
            WHEN SUM(CASE WHEN status::text = 'leave'   THEN 1 ELSE 0 END) > 0  THEN 'leave'
            WHEN SUM(CASE WHEN status::text = 'present' THEN 1.0
                          WHEN status::text = 'half_day' THEN 0.5 ELSE 0 END) >= 1.0 THEN 'present'
            WHEN SUM(CASE WHEN status::text = 'present' THEN 1.0
                          WHEN status::text = 'half_day' THEN 0.5 ELSE 0 END) >= 0.5 THEN 'half_day'
            ELSE 'absent'
          END AS status,
          MAX(marked_at)         AS marked_at,
          MAX(face_match_score)  AS face_match_score,
          bool_or(verified_by_face)  AS verified_by_face,
          bool_or(verified_by_location) AS verified_by_location
        FROM attendance
        WHERE attendance_date = ?
        GROUP BY student_id
      ) agg ON agg.student_id = s.id
      WHERE s.status::text = 'approved'
    `;
    const params = [targetDate];

    if (department_id) {
      sql += ' AND s.department_id = ?';
      params.push(department_id);
    }
    if (year) {
      sql += ' AND s.year = ?';
      params.push(parseInt(year));
    }
    if (semester) {
      sql += ' AND s.semester = ?';
      params.push(parseInt(semester));
    }

    sql += ' ORDER BY s.name';

    const [rows] = await db.query(sql, params);
    return successResponse(res, rows, 'Department attendance fetched.');
  } catch (err) {
    next(err);
  }
}

module.exports = { markAttendance, getAttendanceHistory, getAttendanceStats, getDepartmentAttendance 
}
;
