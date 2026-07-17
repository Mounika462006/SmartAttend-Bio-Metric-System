const db = require('../config/database');
const { successResponse } = require('../utils/response');

/**
 * Get notifications for current user
 * GET /api/notifications
 */
async function getNotifications(req, res, next) {
  try {
    const { id: userId, role } = req.user;
    const [rows] = await db.query(
      `SELECT * FROM notifications
       WHERE user_id = ? AND user_role = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId, role]
    );
    const unreadCount = rows.filter(n => !n.is_read).length;
    return successResponse(res, { notifications: rows, unread_count: unreadCount }, 'Notifications fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Mark notification(s) as read
 * PATCH /api/notifications/read
 */
async function markAsRead(req, res, next) {
  try {
    const { id: userId, role } = req.user;
    const { notification_ids } = req.body;

    if (notification_ids && notification_ids.length > 0) {
      await db.query(
        'UPDATE notifications SET is_read = TRUE WHERE id IN (?) AND user_id = ? AND user_role = ?',
        [notification_ids, userId, role]
      );
    } else {
      await db.query(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND user_role = ?',
        [userId, role]
      );
    }

    return successResponse(res, null, 'Notifications marked as read.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get student profile
 * GET /api/student/profile
 */
async function getStudentProfile(req, res, next) {
  try {
    const studentId = req.user.id;
    const [rows] = await db.query(
      `SELECT s.id, s.student_id, s.name, s.email, s.phone_number AS mobile, s.year, s.semester, s.branch,
              s.status, s.biometric_registered, s.profile_photo_url AS profile_image_url, s.created_at,
              d.name AS department, d.code AS department_code
       FROM students s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.id = ?`,
      [studentId]
    );
    return successResponse(res, rows[0] || null, 'Profile fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get departments list
 * GET /api/departments
 */
async function getDepartments(req, res, next) {
  try {
    let rows;
    try {
      [rows] = await db.query('SELECT id, name, code, category FROM departments WHERE is_active = TRUE ORDER BY name');
    } catch (primaryErr) {
      console.warn('[DB Warning] Primary departments query failed (checking if category column is missing):', primaryErr.message);
      try {
        [rows] = await db.query('SELECT id, name, code FROM departments WHERE is_active = TRUE ORDER BY name');
      } catch (fallbackErr) {
        console.error('[DB Error] Both primary and fallback department queries failed:', fallbackErr.message);
        throw fallbackErr;
      }
    }
    return successResponse(res, rows, 'Departments fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get active campus geo-fencing settings for attendance checks
 * GET /api/geo-fencing/current
 */
async function getCurrentGeoFencing(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT college_name, latitude, longitude, radius_meters
       FROM geo_fencing_settings
       WHERE is_active = TRUE
       LIMIT 1`
    );
    return successResponse(res, rows[0] || null, 'Geo-fencing settings fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Staff dashboard stats
 * GET /api/staff/dashboard
 */
async function getStaffDashboard(req, res, next) {
  try {
    const staffId = req.user.id;
    const [staffInfo] = await db.query('SELECT department_id FROM faculty WHERE id = ?', [staffId]);
    const deptId = staffInfo[0]?.department_id;

    const [[students]] = await db.query(
      "SELECT COUNT(*) AS total FROM students WHERE department_id = ? AND status::text = 'approved'",
      [deptId]
    );
    const [[todayAtt]] = await db.query(
      `SELECT COALESCE(SUM(daily_present), 0) AS present FROM (
         SELECT a.student_id, LEAST(1.0, SUM(CASE WHEN a.status::text = 'present' THEN 1 WHEN a.status::text = 'half_day' THEN 0.5 ELSE 0 END)) AS daily_present
         FROM attendance a
         JOIN students s ON a.student_id = s.id
         WHERE s.department_id = ? AND a.attendance_date = CURRENT_DATE
         GROUP BY a.student_id
       ) AS t`,
      [deptId]
    );
    const [[pendingLeaves]] = await db.query(
      `SELECT COUNT(*) AS total FROM leave_requests lr
       JOIN students s ON lr.student_id = s.id
       WHERE s.department_id = ? AND lr.status::text = 'pending'`,
      [deptId]
    );
    const [lowAttendance] = await db.query(
      `SELECT id, name, student_id, percentage
       FROM (
         SELECT s.id, s.name, s.student_id,
                ROUND(SUM(CASE WHEN a.status::text = 'present' THEN 1 WHEN a.status::text = 'half_day' THEN 0.5 ELSE 0 END) / NULLIF(COUNT(a.id), 0) * 100.0, 1) AS percentage
         FROM students s
         LEFT JOIN attendance a ON a.student_id = s.id
         WHERE s.department_id = ? AND s.status::text = 'approved'
         GROUP BY s.id, s.name, s.student_id
       ) t
       WHERE percentage < 75 OR percentage IS NULL
       ORDER BY percentage ASC
       LIMIT 10`,
      [deptId]
    );

    return successResponse(res, {
      total_students: Number(students.total || 0),
      today_present: Number(todayAtt.present || 0),
      today_absent: Number(students.total || 0) - Number(todayAtt.present || 0),
      pending_leaves: Number(pendingLeaves.total || 0),
      low_attendance_students: lowAttendance.map(s => ({
        ...s,
        percentage: s.percentage !== null ? Number(s.percentage) : 0
      })),
    }, 'Staff dashboard stats fetched.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  getStudentProfile,
  getDepartments,
  getCurrentGeoFencing,
  getStaffDashboard,
};
