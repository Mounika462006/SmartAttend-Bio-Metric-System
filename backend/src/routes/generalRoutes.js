const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { getNotifications, markAsRead, getStudentProfile, getDepartments, getCurrentGeoFencing, getStaffDashboard } = require('../controllers/generalController');
const {
  getPendingStudents, updateStudentStatus, getAllStudents,
  createStudent, updateStudent, deleteStudent,
  getAllStaff, createStaff, updateStaff, deleteStaff,
  getHolidays, createHoliday, deleteHoliday,
  getGeoFencing, updateGeoFencing,
  getAttendanceSettings, updateAttendanceSettings,
  getWorkingDays, updateWorkingDays,
  getDashboardStats, getSecurityLogs,
} = require('../controllers/adminController');

const router = express.Router();

// Public routes
router.get('/departments', getDepartments);

router.use(authenticate);

// Public to all authenticated users
router.get('/notifications', getNotifications);
router.patch('/notifications/read', markAsRead);
router.get('/geo-fencing/current', getCurrentGeoFencing);
router.get('/student/profile', authorize('student'), getStudentProfile);

// Staff routes
router.get('/staff/dashboard', authorize('staff'), getStaffDashboard);

// Admin routes
router.get('/admin/dashboard', authorize('admin'), getDashboardStats);
router.get('/admin/students', authorize('admin'), getAllStudents);
router.post('/admin/students', authorize('admin'), createStudent);
router.put('/admin/students/:id', authorize('admin'), updateStudent);
router.delete('/admin/students/:id', authorize('admin'), deleteStudent);
router.get('/admin/students/pending', authorize('admin'), getPendingStudents);
router.patch('/admin/students/:id/status', authorize('admin'), updateStudentStatus);
router.get('/admin/staff', authorize('admin', 'staff'), getAllStaff);
router.post('/admin/staff', authorize('admin'), createStaff);
router.put('/admin/staff/:id', authorize('admin'), updateStaff);
router.delete('/admin/staff/:id', authorize('admin'), deleteStaff);
router.get('/admin/holidays', authorize('admin', 'staff'), getHolidays);
router.post('/admin/holidays', authorize('admin'), createHoliday);
router.delete('/admin/holidays/:id', authorize('admin'), deleteHoliday);
router.get('/admin/geo-fencing', authorize('admin'), getGeoFencing);
router.put('/admin/geo-fencing', authorize('admin'), updateGeoFencing);
router.get('/admin/attendance-settings', authorize('admin'), getAttendanceSettings);
router.put('/admin/attendance-settings', authorize('admin'), updateAttendanceSettings);
router.get('/admin/working-days', authorize('admin'), getWorkingDays);
router.put('/admin/working-days', authorize('admin'), updateWorkingDays);
router.get('/admin/security-logs', authorize('admin'), getSecurityLogs);

module.exports = router;
