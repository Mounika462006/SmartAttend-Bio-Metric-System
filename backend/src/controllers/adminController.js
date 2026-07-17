const db = require('../config/database');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');

/**
 * Get all pending student registrations
 * GET /api/admin/students/pending
 */
async function getPendingStudents(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT s.id, s.student_id, s.name, s.email, s.phone_number AS mobile, s.year, s.semester, s.branch,
              s.biometric_registered, s.created_at, d.name AS department
       FROM students s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.status = 'pending'
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );

    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) AS total FROM students WHERE status = 'pending'"
    );

    return paginatedResponse(res, rows, total, page, limit, 'Pending students fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Approve or reject student
 * PATCH /api/admin/students/:id/status
 */
async function updateStudentStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return errorResponse(res, 'Status must be approved or rejected.', 400);
    }

    const [rows] = await db.query('SELECT id, name, email FROM students WHERE id = ?', [id]);
    if (!rows.length) return errorResponse(res, 'Student not found.', 404);

    await db.query(
      'UPDATE students SET status = ?, rejected_reason = ? WHERE id = ?',
      [status, reason || null, id]
    );

    // Notify student
    const message = status === 'approved'
      ? 'Your account has been approved. You can now login and register your biometric.'
      : `Your registration was rejected. Reason: ${reason || 'Not specified'}`;

    await db.query(
      `INSERT INTO notifications (user_id, user_role, title, message, type) VALUES (?, 'student', ?, ?, ?)`,
      [id, status === 'approved' ? 'Account Approved' : 'Registration Rejected', message,
       status === 'approved' ? 'success' : 'danger']
    );

    return successResponse(res, null, `Student ${status} successfully.`);
  } catch (err) {
    next(err);
  }
}

/**
 * Get all students with filters
 * GET /api/admin/students
 */
async function getAllStudents(req, res, next) {
  try {
    const { department_id, year, status, page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const countParams = [];

    let countSql = `
      SELECT COUNT(*) AS total
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE 1=1
    `;

    let sql = `
      SELECT s.id, s.student_id, s.name, s.email, s.phone_number AS mobile, s.year, s.semester, s.branch,
             s.status, s.biometric_registered, s.last_login, s.created_at,
             d.name AS department
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE 1=1
    `;

    if (department_id) {
      const deptId = department_id;
      sql += ' AND s.department_id = ?';
      params.push(deptId);
      countSql += ' AND s.department_id = ?';
      countParams.push(deptId);
    }
    if (year) {
      const yr = parseInt(year);
      sql += ' AND s.year = ?';
      params.push(yr);
      countSql += ' AND s.year = ?';
      countParams.push(yr);
    }
    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
      countSql += ' AND s.status = ?';
      countParams.push(status);
    }
    if (search) {
      const s = `%${search}%`;
      sql += ' AND (s.name LIKE ? OR s.student_id LIKE ? OR s.email LIKE ?)';
      params.push(s, s, s);
      countSql += ' AND (s.name LIKE ? OR s.student_id LIKE ? OR s.email LIKE ?)';
      countParams.push(s, s, s);
    }

    const [[{ total }]] = await db.query(countSql, countParams);

    sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);
    return paginatedResponse(res, rows, total, page, limit, 'Students fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get all staff
 * GET /api/admin/staff
 */
async function getAllStaff(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT f.id, f.employee_id AS staff_id, f.name, f.email, f.phone AS mobile, f.designation,
              f.is_active, f.last_login, f.created_at, d.name AS department
       FROM faculty f
       LEFT JOIN departments d ON f.department_id = d.id
       ORDER BY f.name`
    );
    return successResponse(res, rows, 'Staff fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Create new staff
 * POST /api/admin/staff
 */
async function createStaff(req, res, next) {
  try {
    const bcrypt = require('bcryptjs');
    const { name, staff_id, email, mobile, department_id, designation, password } = req.body;

    const emailLower = email.toLowerCase();
    const [existing] = await db.query('SELECT id FROM faculty WHERE email = ?', [email]);
    if (existing.length) return errorResponse(res, 'Staff with this email already exists.', 409);

    const passwordHash = await bcrypt.hash(password || 'staff@123', 12);

    const [result] = await db.query(
      'INSERT INTO faculty (employee_id, name, email, password_hash, phone, department_id, designation, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)',
      [staff_id, name, email, passwordHash, mobile || '', department_id, designation]
    );

    return successResponse(res, { id: result.insertId }, 'Staff created successfully.', 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Update staff details
 * PUT /api/admin/staff/:id
 */
async function updateStaff(req, res, next) {
  try {
    const { id } = req.params;
    const { name, staff_id, email, mobile, department_id, designation, is_active } = req.body;

    const emailLower = email.toLowerCase();
    const [emailCheck] = await db.query('SELECT id FROM faculty WHERE email = ? AND id != ?', [email, id]);
    if (emailCheck.length) return errorResponse(res, 'Email already in use by another staff member.', 409);

    const [idCheck] = await db.query('SELECT id FROM faculty WHERE employee_id = ? AND id != ?', [staff_id, id]);
    if (idCheck.length) return errorResponse(res, 'Staff ID already in use.', 409);

    await db.query(
      `UPDATE faculty 
       SET name = ?, employee_id = ?, email = ?, phone = ?, department_id = ?, designation = ?, is_active = ? 
       WHERE id = ?`,
      [name, staff_id, email, mobile, department_id, designation, !!is_active, id]
    );

    return successResponse(res, null, 'Staff updated successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Delete staff account
 * DELETE /api/admin/staff/:id
 */
async function deleteStaff(req, res, next) {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM faculty WHERE id = ?', [id]);
    return successResponse(res, null, 'Staff deleted successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Create new student directly (pre-approved)
 * POST /api/admin/students
 */
async function createStudent(req, res, next) {
  try {
    const bcrypt = require('bcryptjs');
    const { name, student_id, email, mobile, department_id, branch, year, semester, password } = req.body;

    const [emailCheck] = await db.query('SELECT id FROM students WHERE email = ?', [email]);
    if (emailCheck.length) return errorResponse(res, 'Student with this email already exists.', 409);

    const [sidCheck] = await db.query('SELECT id FROM students WHERE student_id = ?', [student_id]);
    if (sidCheck.length) return errorResponse(res, 'Student ID already registered.', 409);

    const passwordHash = await bcrypt.hash(password || 'student@123', 12);

    const phone   = mobile || '';
    const regNum  = student_id;
    const gendr   = 'other';
    const dob     = '2000-01-01';
    const acYear  = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    const sect    = 'A';
    const btch    = String(new Date().getFullYear());
    const admYr   = new Date().getFullYear();

    const [result] = await db.query(
      `INSERT INTO students (student_id, register_number, name, email, phone_number, gender, date_of_birth,
                             department_id, academic_year, semester, section, batch, admission_year,
                             password_hash, is_active, biometric_registered, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, FALSE, 'approved')`,
      [student_id, regNum, name, email, phone, gendr, dob,
       department_id, acYear, parseInt(semester), sect, btch, admYr, passwordHash]
    );

    return successResponse(res, { id: result.insertId }, 'Student created successfully.', 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Update student details
 * PUT /api/admin/students/:id
 */
async function updateStudent(req, res, next) {
  try {
    const { id } = req.params;
    const { name, student_id, email, mobile, department_id, branch, year, semester, status, is_active } = req.body;

    const [emailCheck] = await db.query('SELECT id FROM students WHERE email = ? AND id != ?', [email, id]);
    if (emailCheck.length) return errorResponse(res, 'Email already in use by another student.', 409);

    const [sidCheck] = await db.query('SELECT id FROM students WHERE student_id = ? AND id != ?', [student_id, id]);
    if (sidCheck.length) return errorResponse(res, 'Student ID already in use.', 409);

    await db.query(
      `UPDATE students 
       SET name = ?, student_id = ?, email = ?, phone_number = ?, department_id = ?, branch = ?, year = ?, semester = ?, status = ?, is_active = ? 
       WHERE id = ?`,
      [name, student_id, email, mobile, department_id, branch, year, semester, status, !!is_active, id]
    );

    return successResponse(res, null, 'Student updated successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Delete student account
 * DELETE /api/admin/students/:id
 */
async function deleteStudent(req, res, next) {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM students WHERE id = ?', [id]);
    return successResponse(res, null, 'Student deleted successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Manage holidays
 * GET /api/admin/holidays
 */
async function getHolidays(req, res, next) {
  try {
    const { academic_year } = req.query;
    let sql = 'SELECT * FROM holidays';
    const params = [];
    if (academic_year) { sql += ' WHERE academic_year = ?'; params.push(academic_year); }
    sql += ' ORDER BY from_date';
    const [rows] = await db.query(sql, params);
    return successResponse(res, rows, 'Holidays fetched.');
  } catch (err) {
    next(err);
  }
}

async function createHoliday(req, res, next) {
  try {
    const { name, from_date, to_date, type, description, academic_year } = req.body;
    const [result] = await db.query(
      'INSERT INTO holidays (name, from_date, to_date, type, description, academic_year, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, from_date, to_date || from_date, type, description, academic_year, req.user.id]
    );
    return successResponse(res, { id: result.insertId }, 'Holiday created.', 201);
  } catch (err) {
    next(err);
  }
}

async function deleteHoliday(req, res, next) {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM holidays WHERE id = ?', [id]);
    return successResponse(res, null, 'Holiday deleted.');
  } catch (err) {
    next(err);
  }
}

/**
 * Geo-fencing settings
 */
async function getGeoFencing(req, res, next) {
  try {
    const [rows] = await db.query('SELECT * FROM geo_fencing_settings WHERE is_active = TRUE LIMIT 1');
    return successResponse(res, rows[0] || null, 'Geo-fencing settings fetched.');
  } catch (err) {
    next(err);
  }
}

async function updateGeoFencing(req, res, next) {
  try {
    const { college_name, latitude, longitude, radius_meters } = req.body;
    const [existing] = await db.query('SELECT id FROM geo_fencing_settings WHERE is_active = TRUE LIMIT 1');

    if (existing.length) {
      await db.query(
        'UPDATE geo_fencing_settings SET college_name = ?, latitude = ?, longitude = ?, radius_meters = ?, updated_by = ? WHERE id = ?',
        [college_name, latitude, longitude, radius_meters, req.user.id, existing[0].id]
      );
    } else {
      await db.query(
        'INSERT INTO geo_fencing_settings (college_name, latitude, longitude, radius_meters) VALUES (?, ?, ?, ?)',
        [college_name, latitude, longitude, radius_meters]
      );
    }

    return successResponse(res, null, 'Geo-fencing settings updated.');
  } catch (err) {
    next(err);
  }
}

/**
 * Attendance settings
 */
async function getAttendanceSettings(req, res, next) {
  try {
    const [rows] = await db.query('SELECT * FROM attendance_settings ORDER BY id');
    return successResponse(res, rows, 'Attendance settings fetched.');
  } catch (err) {
    next(err);
  }
}

async function updateAttendanceSettings(req, res, next) {
  try {
    const { sessions } = req.body; // Array of session objects
    const ALLOWED_SESSIONS = ['Morning', 'Afternoon', 'Evening'];
    for (const session of sessions) {
      const { id, session_name, start_time, end_time, grace_minutes, is_active } = session;
      if (!ALLOWED_SESSIONS.includes(session_name)) {
        return errorResponse(res, `Invalid session name "${session_name}". Allowed: Morning, Afternoon, Evening.`, 400);
      }
      await db.query(
        'UPDATE attendance_settings SET session_name=?, start_time=?, end_time=?, grace_minutes=?, is_active=? WHERE id=?',
        [session_name, start_time, end_time, grace_minutes, !!is_active, id]
      );
    }
    return successResponse(res, null, 'Attendance settings updated.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get active working days / academic calendar
 * GET /api/admin/working-days
 */
async function getWorkingDays(req, res, next) {
  try {
    const [rows] = await db.query(
      'SELECT * FROM working_days WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1'
    );
    if (!rows.length) return successResponse(res, null, 'No working days configuration found.');
    const wd = rows[0];
    // Parse JSON if stored as string
    if (typeof wd.working_days_json === 'string') {
      wd.working_days_json = JSON.parse(wd.working_days_json || '[]');
    }
    return successResponse(res, wd, 'Working days fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Update active working days / academic calendar
 * PUT /api/admin/working-days
 */
async function updateWorkingDays(req, res, next) {
  try {
    const { academic_year, semester_label, semester_start, semester_end, working_days_json } = req.body;

    if (!academic_year || !semester_start || !semester_end || !working_days_json) {
      return errorResponse(res, 'academic_year, semester_start, semester_end and working_days_json are required.', 400);
    }
    if (!Array.isArray(working_days_json) || working_days_json.length === 0) {
      return errorResponse(res, 'working_days_json must be a non-empty array of day names.', 400);
    }

    const VALID_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    for (const d of working_days_json) {
      if (!VALID_DAYS.includes(d)) {
        return errorResponse(res, `Invalid day "${d}". Must be one of: ${VALID_DAYS.join(', ')}.`, 400);
      }
    }

    const [existing] = await db.query('SELECT id FROM working_days WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1');

    if (existing.length) {
      await db.query(
        `UPDATE working_days
         SET academic_year = ?, semester_label = ?, semester_start = ?, semester_end = ?,
             working_days_json = ?, updated_at = NOW()
         WHERE id = ?`,
        [academic_year, semester_label || null, semester_start, semester_end,
         JSON.stringify(working_days_json), existing[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO working_days (academic_year, semester_label, semester_start, semester_end, working_days_json, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, TRUE, ?)`,
        [academic_year, semester_label || null, semester_start, semester_end,
         JSON.stringify(working_days_json), req.user.id]
      );
    }

    return successResponse(res, null, 'Academic calendar updated successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Dashboard analytics summary
 * GET /api/admin/dashboard
 */
async function getDashboardStats(req, res, next) {
  try {
    const [[students]] = await db.query(
      `SELECT COUNT(*) AS total, 
              SUM(CASE WHEN status::text = 'pending' THEN 1 ELSE 0 END) AS pending, 
              SUM(CASE WHEN status::text = 'approved' THEN 1 ELSE 0 END) AS approved 
       FROM students`
    );
    const [[staff]] = await db.query('SELECT COUNT(*) AS total FROM faculty WHERE is_active = TRUE');
    const [[todayAtt]] = await db.query(
      `SELECT COALESCE(SUM(daily_present), 0) AS total FROM (
         SELECT student_id, LEAST(1.0, SUM(CASE WHEN status::text = 'present' THEN 1 WHEN status::text = 'half_day' THEN 0.5 ELSE 0 END)) AS daily_present
         FROM attendance
         WHERE attendance_date = CURRENT_DATE
         GROUP BY student_id
       ) AS t`
    );
    const [[leaves]] = await db.query(
      "SELECT COUNT(*) AS pending FROM leave_requests WHERE status = 'pending'"
    );
    const [deptStats] = await db.query(
      `SELECT d.name AS department,
              COUNT(s.id) AS total_students,
              COALESCE(SUM(t.daily_present), 0) AS present_today
       FROM departments d
       LEFT JOIN students s ON s.department_id = d.id AND s.status::text = 'approved'
       LEFT JOIN (
         SELECT student_id, LEAST(1.0, SUM(CASE WHEN status::text = 'present' THEN 1 WHEN status::text = 'half_day' THEN 0.5 ELSE 0 END)) AS daily_present
         FROM attendance
         WHERE attendance_date = CURRENT_DATE
         GROUP BY student_id
       ) t ON t.student_id = s.id
       GROUP BY d.id, d.name
       ORDER BY d.name`
    );

    return successResponse(res, {
      students: {
        total: Number(students.total || 0),
        pending: Number(students.pending || 0),
        approved: Number(students.approved || 0),
      },
      staff: { total: Number(staff.total || 0) },
      today_attendance: Number(todayAtt.total || 0),
      pending_leaves: Number(leaves.pending || 0),
      department_stats: deptStats.map(d => ({
        department: d.department,
        total_students: Number(d.total_students || 0),
        present_today: Number(d.present_today || 0)
      })),
    }, 'Dashboard stats fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Security logs
 * GET /api/admin/security-logs
 */
async function getSecurityLogs(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT sl.*, 
              COALESCE(s.name, st.name, a.name) AS user_name
       FROM security_logs sl
       LEFT JOIN students s ON sl.user_role = 'student' AND sl.user_id = s.id
       LEFT JOIN faculty st ON sl.user_role = 'staff' AND sl.user_id = st.id
       LEFT JOIN admins a ON sl.user_role = 'admin' AND sl.user_id = a.id
       ORDER BY sl.created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );

    return successResponse(res, rows, 'Security logs fetched.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPendingStudents, updateStudentStatus, getAllStudents,
  createStudent, updateStudent, deleteStudent,
  getAllStaff, createStaff, updateStaff, deleteStaff,
  getHolidays, createHoliday, deleteHoliday,
  getGeoFencing, updateGeoFencing,
  getAttendanceSettings, updateAttendanceSettings,
  getWorkingDays, updateWorkingDays,
  getDashboardStats, getSecurityLogs,
};
