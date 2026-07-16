const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateTokenPair, verifyRefreshToken } = require('../config/jwt');
const { successResponse, errorResponse } = require('../utils/response');

const SALT_ROUNDS = 12;

/**
 * Login handler for all roles (student, staff, admin)
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password, role } = req.body;

    let user = null;
    let table = '';

    if (role === 'admin') {
      table = 'admins';
      const [rows] = await db.query(
        'SELECT id, name, email, password_hash, is_active FROM admins WHERE email = ?',
        [email]
      );
      user = rows[0] || null;
    } else if (role === 'staff') {
      table = 'staff';
      const [rows] = await db.query(
        'SELECT id, name, email, password_hash, department_id, designation, is_active FROM staff WHERE email = ?',
        [email]
      );
      user = rows[0] || null;
    } else if (role === 'student') {
      table = 'students';
      const [rows] = await db.query(
        `SELECT s.id, s.name, s.email, s.password_hash, s.status, s.biometric_registered,
                s.student_id, s.department_id, s.branch, s.year, s.semester, s.is_active,
                d.name AS department_name
         FROM students s
         LEFT JOIN departments d ON s.department_id = d.id
         WHERE s.email = ?`,
        [email]
      );
      user = rows[0] || null;
    } else {
      return errorResponse(res, 'Invalid role specified.', 400);
    }

    if (!user) {
      return errorResponse(res, 'Invalid credentials. Please try again.', 401);
    }

    if (!user.is_active) {
      return errorResponse(res, 'Your account has been deactivated. Please contact the administrator.', 403);
    }

    // Student-specific checks
    if (role === 'student') {
      if (user.status === 'pending') {
        return errorResponse(res, 'Your account is pending admin approval. Please wait for verification.', 403);
      }
      if (user.status === 'rejected') {
        return errorResponse(res, 'Your account registration was rejected. Please contact the administrator.', 403);
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      // Log failed attempt
      await db.query(
        'INSERT INTO security_logs (user_id, user_role, action, details, ip_address, status) VALUES (?, ?, ?, ?, ?, ?)',
        [user.id, role, 'LOGIN_FAILED', JSON.stringify({ email }), req.ip, 'failure']
      );
      return errorResponse(res, 'Invalid credentials. Please try again.', 401);
    }

    // Update last login
    await db.query(`UPDATE ${table} SET last_login = NOW() WHERE id = ?`, [user.id]);

    const tokenPayload = { id: user.id, email: user.email, role };
    const tokens = generateTokenPair(tokenPayload);

    // Log successful login
    await db.query(
      'INSERT INTO security_logs (user_id, user_role, action, ip_address, status) VALUES (?, ?, ?, ?, ?)',
      [user.id, role, 'LOGIN_SUCCESS', req.ip, 'success']
    );

    // Remove sensitive data
    delete user.password_hash;

    return successResponse(res, {
      user: { ...user, role },
      ...tokens,
    }, 'Login successful.');
  } catch (err) {
    next(err);
  }
}

/**
 * Student Registration
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const { name, student_id, department_id, branch, year, semester, email, mobile, password } = req.body;

    // Check duplicates
    const [emailCheck] = await db.query('SELECT id FROM students WHERE email = ?', [email]);
    if (emailCheck.length > 0) {
      return errorResponse(res, 'An account with this email already exists.', 409);
    }

    const [sidCheck] = await db.query('SELECT id FROM students WHERE student_id = ?', [student_id]);
    if (sidCheck.length > 0) {
      return errorResponse(res, 'This Student ID is already registered.', 409);
    }

    // Validate department
    const [deptCheck] = await db.query('SELECT id FROM departments WHERE id = ? AND is_active = TRUE', [department_id]);
    if (!deptCheck.length) {
      return errorResponse(res, 'Selected department is invalid.', 400);
    }

    // Validate branch
    if (!branch || !branch.trim()) {
      return errorResponse(res, 'Branch/Specialization is required.', 400);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await db.query(
      `INSERT INTO students (student_id, name, email, mobile, password_hash, department_id, branch, year, semester, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [student_id, name, email, mobile, passwordHash, department_id, branch, year, semester]
    );

    // Notify admin about new registration
    const [admins] = await db.query('SELECT id FROM admins WHERE is_active = TRUE');
    for (const admin of admins) {
      await db.query(
        `INSERT INTO notifications (user_id, user_role, title, message, type) VALUES (?, 'admin', ?, ?, 'info')`,
        [admin.id, 'New Student Registration', `${name} (${student_id}) has registered and is pending approval.`]
      );
    }

    return successResponse(
      res,
      { student_id: result.insertId },
      'Registration submitted successfully. Please wait for admin approval.',
      201
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
async function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return errorResponse(res, 'Refresh token is required.', 400);
    }

    const decoded = verifyRefreshToken(refreshToken);
    const { generateAccessToken } = require('../config/jwt');
    const newAccessToken = generateAccessToken({ id: decoded.id, email: decoded.email, role: decoded.role });

    return successResponse(res, { accessToken: newAccessToken }, 'Token refreshed successfully.');
  } catch (err) {
    return errorResponse(res, 'Invalid or expired refresh token. Please login again.', 401);
  }
}

/**
 * Logout (client-side token invalidation)
 * POST /api/auth/logout
 */
async function logout(req, res, next) {
  try {
    if (req.user) {
      await db.query(
        'INSERT INTO security_logs (user_id, user_role, action, ip_address, status) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, req.user.role, 'LOGOUT', req.ip, 'success']
      );
    }
    return successResponse(res, null, 'Logged out successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register, refreshToken, logout };
