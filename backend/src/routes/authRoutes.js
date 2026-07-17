const express = require('express');
const { body } = require('express-validator');
const { login, register, refreshToken, logout } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');

const router = express.Router();

// Login validation
const loginValidation = [
  body('email')
    .isEmail().withMessage('Valid email is required.')
    .normalizeEmail()
    .custom((value, { req }) => {
      if (req.body.role === 'student' || req.body.role === 'staff') {
        const lower = value.toLowerCase();
        const domainMatch = lower.endsWith('.edu') || lower.endsWith('.edu.in') || lower.endsWith('.edu.com');
        if (!domainMatch) {
          throw new Error('Email must end with .edu, .edu.in or .edu.com');
        }
      }
      return true;
    }),
  body('password').notEmpty().withMessage('Password is required.'),
  body('role').isIn(['student', 'staff', 'admin']).withMessage('Valid role is required.'),
];

// Registration validation
const registerValidation = [
  body('name').trim().notEmpty().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters.'),
  body('student_id').trim().notEmpty().withMessage('Student ID is required.'),
  // Accept both UUID (from new schema) and integer department IDs
  body('department_id')
    .notEmpty().withMessage('Department is required.')
    .custom((value) => {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      const isInt = Number.isInteger(Number(value)) && Number(value) > 0;
      if (!isUUID && !isInt) {
        throw new Error('Valid department is required.');
      }
      return true;
    }),
  // year is optional in new schema (admission_year is used instead) but validate if given
  body('year').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1, max: 6 }).withMessage('Year must be between 1 and 6.'),
  body('semester').isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1 and 8.'),
  body('email')
    .isEmail().withMessage('Valid email is required.')
    .normalizeEmail(),
  // mobile/phone_number: either one is acceptable, both are optional at validation level
  body('mobile').optional({ nullable: true, checkFalsy: true }).isMobilePhone('en-IN').withMessage('Valid Indian mobile number is required.'),
  body('phone_number').optional({ nullable: true, checkFalsy: true }).isMobilePhone('en-IN').withMessage('Valid Indian mobile number is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number.'),
];

router.post('/login', loginValidation, validate, login);
router.post('/register', registerValidation, validate, register);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);

module.exports = router;
