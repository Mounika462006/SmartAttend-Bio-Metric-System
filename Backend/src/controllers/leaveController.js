const db = require('../config/database');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { uploadToSupabase } = require('../utils/supabaseStorage');

/**
 * Get all leave requests (Staff can filter by department)
 * GET /api/leave/all
 */
async function getAllLeaves(req, res, next) {
  try {
    const { status, department_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const countParams = [];

    let countSql = `
      SELECT COUNT(*) AS total
      FROM leave_requests lr
      JOIN students s ON lr.student_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE 1=1
    `;

    let sql = `
      SELECT lr.id, lr.leave_type, lr.from_date, lr.to_date, lr.reason,
             lr.status, lr.attachment_url, lr.review_comment, lr.reviewed_at, lr.created_at,
             s.name AS student_name, s.student_id, s.year, s.semester, s.branch,
             d.name AS department,
             sf.name AS reviewed_by_name
      FROM leave_requests lr
      JOIN students s ON lr.student_id = s.id
      JOIN departments d ON s.department_id = d.id
      LEFT JOIN staff sf ON lr.reviewed_by = sf.id
      WHERE 1=1
    `;

    if (status) {
      sql += ' AND lr.status = ?';
      params.push(status);
      countSql += ' AND lr.status = ?';
      countParams.push(status);
    }
    if (department_id) {
      const deptId = parseInt(department_id);
      sql += ' AND s.department_id = ?';
      params.push(deptId);
      countSql += ' AND s.department_id = ?';
      countParams.push(deptId);
    }

    const [[{ total }]] = await db.query(countSql, countParams);

    sql += ' ORDER BY lr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);
    return paginatedResponse(res, rows, total, page, limit, 'Leave requests fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get student's own leave requests
 * GET /api/leave/my
 */
async function getMyLeaves(req, res, next) {
  try {
    const studentId = req.user.id;
    const [rows] = await db.query(
      `SELECT lr.*, sf.name AS reviewed_by_name
       FROM leave_requests lr
       LEFT JOIN staff sf ON lr.reviewed_by = sf.id
       WHERE lr.student_id = ?
       ORDER BY lr.created_at DESC`,
      [studentId]
    );
    return successResponse(res, rows, 'Leave requests fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Apply for leave
 * POST /api/leave/apply
 */
async function applyLeave(req, res, next) {
  try {
    const studentId = req.user.id;
    const { leave_type, from_date, to_date, reason } = req.body;
    
    let attachmentUrl = null;

    if (req.file) {
      attachmentUrl = await uploadToSupabase(
        req.file.buffer,
        req.file.originalname,
        'leaves',
        req.file.mimetype
      );
    }

    // Check for overlapping leave
    const [overlap] = await db.query(
      `SELECT id FROM leave_requests
       WHERE student_id = ? AND status != 'rejected'
       AND NOT (to_date < ? OR from_date > ?)`,
      [studentId, from_date, to_date]
    );
    if (overlap.length) {
      return errorResponse(res, 'A leave request already exists for overlapping dates.', 409);
    }

    const [result] = await db.query(
      `INSERT INTO leave_requests (student_id, leave_type, from_date, to_date, reason, attachment_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [studentId, leave_type, from_date, to_date, reason, attachmentUrl]
    );

    // Notify staff in department
    const [studentInfo] = await db.query('SELECT name, department_id FROM students WHERE id = ?', [studentId]);
    const [staffList] = await db.query('SELECT id FROM staff WHERE department_id = ? AND is_active = 1', [studentInfo[0].department_id]);

    for (const staff of staffList) {
      await db.query(
        `INSERT INTO notifications (user_id, user_role, title, message, type) VALUES (?, 'staff', ?, ?, 'info')`,
        [staff.id, 'New Leave Request', `${studentInfo[0].name} has applied for ${leave_type} leave from ${from_date} to ${to_date}.`]
      );
    }

    return successResponse(res, { id: result.insertId }, 'Leave request submitted successfully.', 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Review leave request (Staff)
 * PATCH /api/leave/:id/review
 */
async function reviewLeave(req, res, next) {
  try {
    const { id } = req.params;
    const { status, review_comment } = req.body;
    const staffId = req.user.id;

    if (!['approved', 'rejected'].includes(status)) {
      return errorResponse(res, 'Status must be approved or rejected.', 400);
    }

    const [rows] = await db.query(
      'SELECT lr.*, s.name AS student_name FROM leave_requests lr JOIN students s ON lr.student_id = s.id WHERE lr.id = ?',
      [id]
    );
    if (!rows.length) return errorResponse(res, 'Leave request not found.', 404);

    const leave = rows[0];

    await db.query(
      'UPDATE leave_requests SET status = ?, reviewed_by = ?, review_comment = ?, reviewed_at = NOW() WHERE id = ?',
      [status, staffId, review_comment || null, id]
    );

    // Update attendance records as 'leave' if approved
    if (status === 'approved') {
      const start = new Date(leave.from_date);
      const end = new Date(leave.to_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        // Only mark if not already marked as present
        const [existing] = await db.query(
          "SELECT id FROM attendance WHERE student_id = ? AND attendance_date = ? AND status IN ('present', 'halfday')",
          [leave.student_id, dateStr]
        );
        if (!existing.length) {
          await db.query(
            `INSERT INTO attendance (student_id, attendance_date, status, session, is_manual, marked_by_staff)
             VALUES (?, ?, 'leave', 'Morning', 1, ?)
             ON CONFLICT (student_id, attendance_date, session) DO UPDATE SET status = 'leave'`,
            [leave.student_id, dateStr, staffId]
          );
        }
      }
    }

    // Notify student
    await db.query(
      `INSERT INTO notifications (user_id, user_role, title, message, type) VALUES (?, 'student', ?, ?, ?)`,
      [leave.student_id,
       `Leave ${status.charAt(0).toUpperCase() + status.slice(1)}`,
       `Your leave request from ${leave.from_date} to ${leave.to_date} has been ${status}.${review_comment ? ` Comment: ${review_comment}` : ''}`,
       status === 'approved' ? 'success' : 'danger']
    );

    return successResponse(res, null, `Leave ${status} successfully.`);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllLeaves, getMyLeaves, applyLeave, reviewLeave };
