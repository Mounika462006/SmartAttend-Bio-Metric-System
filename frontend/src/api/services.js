import api from './axios';

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: () => api.post('/auth/logout'),
};

export const attendanceAPI = {
  mark: (data) => api.post('/attendance/mark', data),
  getHistory: (params) => api.get('/attendance/history', { params }),
  getStats: () => api.get('/attendance/stats'),
  getDepartment: (params) => api.get('/attendance/department', { params }),
};

export const biometricAPI = {
  register: (formData) =>
    api.post('/biometric/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getDescriptor: () => api.get('/biometric/descriptor'),
  getStatus: () => api.get('/biometric/status'),
  deleteForStudent: (studentId) => api.delete(`/biometric/students/${studentId}`),
};

export const leaveAPI = {
  apply: (formData) =>
    api.post('/leave/apply', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getMyLeaves: () => api.get('/leave/my'),
  getAllLeaves: (params) => api.get('/leave/all', { params }),
  review: (id, data) => api.patch(`/leave/${id}/review`, data),
};

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getStudents: (params) => api.get('/admin/students', { params }),
  createStudent: (data) => api.post('/admin/students', data),
  updateStudent: (id, data) => api.put(`/admin/students/${id}`, data),
  deleteStudent: (id) => api.delete(`/admin/students/${id}`),
  getPendingStudents: (params) => api.get('/admin/students/pending', { params }),
  updateStudentStatus: (id, data) => api.patch(`/admin/students/${id}/status`, data),
  getStaff: () => api.get('/admin/staff'),
  createStaff: (data) => api.post('/admin/staff', data),
  updateStaff: (id, data) => api.put(`/admin/staff/${id}`, data),
  deleteStaff: (id) => api.delete(`/admin/staff/${id}`),
  getHolidays: (params) => api.get('/admin/holidays', { params }),
  createHoliday: (data) => api.post('/admin/holidays', data),
  deleteHoliday: (id) => api.delete(`/admin/holidays/${id}`),
  getGeoFencing: () => api.get('/admin/geo-fencing'),
  updateGeoFencing: (data) => api.put('/admin/geo-fencing', data),
  getAttendanceSettings: () => api.get('/admin/attendance-settings'),
  updateAttendanceSettings: (data) => api.put('/admin/attendance-settings', data),
  getWorkingDays: () => api.get('/admin/working-days'),
  updateWorkingDays: (data) => api.put('/admin/working-days', data),
  getSecurityLogs: (params) => api.get('/admin/security-logs', { params }),
};

export const generalAPI = {
  getDepartments: (config) => api.get('/departments', config),
  getCampusGeoFence: () => api.get('/geo-fencing/current'),
  getNotifications: () => api.get('/notifications'),
  markNotificationsRead: (ids) => api.patch('/notifications/read', { notification_ids: ids }),
  getStudentProfile: () => api.get('/student/profile'),
  getStaffDashboard: () => api.get('/staff/dashboard'),
};
