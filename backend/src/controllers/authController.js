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
    const { email, password, role } = req.body || {};
    if (!email || !password || !role) {
      return errorResponse(res, 'Email, password, and role are required.', 400);
    }

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
      // New schema uses "faculty" table; fall back to "staff" if needed
      try {
        table = 'faculty';
        const [rows] = await db.query(
          'SELECT id, name, email, password_hash, department_id, designation, is_active FROM faculty WHERE email = ?',
          [email]
        );
        user = rows[0] || null;
      } catch {
        table = 'staff';
        const [rows] = await db.query(
          'SELECT id, name, email, password_hash, department_id, designation, is_active FROM staff WHERE email = ?',
          [email]
        );
        user = rows[0] || null;
      }

    } else if (role === 'student') {
      table = 'students';
      const [rows] = await db.query(
        `SELECT s.id, s.name, s.email, s.password_hash, s.status,
                s.biometric_registered, s.student_id, s.department_id,
                s.branch, s.year, s.semester, s.is_active,
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
      return errorResponse(res, 'User not found. Please check your email and role.', 404);
    }

    // is_active may be null in new schema for students — treat null as active
    if (user.is_active === false) {
      return errorResponse(res, 'Your account has been deactivated. Please contact the administrator.', 403);
    }

    // Student-specific status checks
    if (role === 'student') {
      if (user.status === 'pending') {
        return errorResponse(res, 'Your account is pending admin approval. Please wait for verification.', 403);
      }
      if (user.status === 'suspended' || user.status === 'inactive') {
        return errorResponse(res, 'Your account has been suspended. Please contact the administrator.', 403);
      }
    }

    if (!user.password_hash) {
      return errorResponse(res, 'Account password not set. Please contact the administrator.', 403);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      // Log failed attempt — non-fatal if security_logs table missing
      try {
        await db.query(
          'INSERT INTO security_logs (user_id, user_role, action, details, ip_address, status) VALUES (?, ?, ?, ?, ?, ?)',
          [user.id, role, 'LOGIN_FAILED', JSON.stringify({ email }), req.ip, 'failure']
        );
      } catch { /* security_logs table may not exist */ }
      return errorResponse(res, 'Invalid password.', 401);
    }

    // Update last login — non-fatal if column missing
    try {
      await db.query(`UPDATE ${table} SET last_login = NOW() WHERE id = ?`, [user.id]);
    } catch { /* last_login column may not exist */ }

    const tokenPayload = { id: user.id, email: user.email, role };
    const tokens = generateTokenPair(tokenPayload);

    // Log successful login — non-fatal
    try {
      await db.query(
        'INSERT INTO security_logs (user_id, user_role, action, ip_address, status) VALUES (?, ?, ?, ?, ?)',
        [user.id, role, 'LOGIN_SUCCESS', req.ip, 'success']
      );
    } catch { /* security_logs table may not exist */ }

    // Remove sensitive data before sending
    delete user.password_hash;

    return successResponse(res, {
      user: { ...user, role },
      ...tokens,
    }, 'Login successful.');
  } catch (err) {
    console.error('[Login] Error:', err.message);
    next(err);
  }
}

/**
 * Student Registration
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const {
      name, student_id, register_number, department_id,
      semester, section, batch, admission_year, academic_year,
      email, mobile, phone_number, gender, date_of_birth, password
    } = req.body;

    // Check duplicates
    const [emailCheck] = await db.query('SELECT id FROM students WHERE email = ?', [email]);
    if (emailCheck.length > 0) {
      return errorResponse(res, 'An account with this email already exists.', 409);
    }

    const [sidCheck] = await db.query('SELECT id FROM students WHERE student_id = ?', [student_id]);
    if (sidCheck.length > 0) {
      return errorResponse(res, 'This Student ID is already registered.', 409);
    }

    // Validate department (works for both UUID and integer IDs)
    const [deptCheck] = await db.query('SELECT id FROM departments WHERE id = ? AND is_active = TRUE', [department_id]);
    if (!deptCheck.length) {
      return errorResponse(res, 'Selected department is invalid. Please select a valid department from the list.', 400);
    }

    // Normalise all fields to match the new Supabase schema
    const phone   = phone_number || mobile || '';
    const regNum  = register_number || student_id;
    const gendr   = gender   || 'other';
    const dob     = date_of_birth || '2000-01-01'; // safe default (NOT NULL in schema)
    const acYear  = academic_year || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    const sect    = section  || 'A';
    const btch    = batch    || String(new Date().getFullYear());
    const admYr   = admission_year ? parseInt(admission_year) : new Date().getFullYear();

    // Hash password for the password_hash column (added via migration)
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [insertResult] = await db.query(
      `INSERT INTO students
        (student_id, register_number, name, email, phone_number, gender, date_of_birth,
         department_id, academic_year, semester, section, batch, admission_year,
         password_hash, is_active, biometric_registered, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, FALSE, 'pending')`,
      [student_id, regNum, name, email, phone, gendr, dob,
       department_id, acYear, parseInt(semester), sect, btch, admYr, passwordHash]
    );

    // Notify admins — wrapped so failure never blocks registration
    try {
      const [admins] = await db.query('SELECT id FROM admins WHERE is_active = TRUE');
      for (const admin of admins) {
        await db.query(
          `INSERT INTO notifications (user_id, user_role, title, message, type) VALUES (?, 'admin', ?, ?, 'info')`,
          [admin.id, 'New Student Registration', `${name} (${student_id}) has registered and is pending approval.`]
        );
      }
    } catch (notifErr) {
      console.warn('[Register] Failed to send admin notifications:', notifErr.message);
    }

    return successResponse(
      res,
      { student_id: insertResult.insertId },
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
      try {
        await db.query(
          'INSERT INTO security_logs (user_id, user_role, action, ip_address, status) VALUES (?, ?, ?, ?, ?)',
          [req.user.id, req.user.role, 'LOGOUT', req.ip, 'success']
        );
      } catch { /* non-fatal */ }
    }
    return successResponse(res, null, 'Logged out successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register, refreshToken, logout };
