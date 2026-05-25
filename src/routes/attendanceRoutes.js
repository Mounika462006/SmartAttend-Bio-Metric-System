const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { markAttendance, getAttendanceHistory, getAttendanceStats, getDepartmentAttendance } = require('../controllers/attendanceController');

const router = express.Router();

router.use(authenticate);

// Student routes
router.post('/mark', authorize('student'), markAttendance);
router.get('/history', authorize('student'), getAttendanceHistory);
router.get('/stats', authorize('student'), getAttendanceStats);

// Staff/Admin routes
router.get('/department', authorize('staff', 'admin'), getDepartmentAttendance);

module.exports = router;
