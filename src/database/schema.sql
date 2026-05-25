-- ============================================================
-- Smart Face Biometric Attendance System - MySQL Schema
-- Database: smart_attendance_db
-- ============================================================

CREATE DATABASE IF NOT EXISTS smart_attendance_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_attendance_db;

-- ============================================================
-- TABLE: departments
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dept_code (code),
  INDEX idx_dept_active (is_active)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: admins
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_admin_email (email)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: staff
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_id VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  mobile VARCHAR(15),
  department_id INT UNSIGNED NOT NULL,
  designation VARCHAR(80),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE,
  INDEX idx_staff_email (email),
  INDEX idx_staff_dept (department_id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: students
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(30) NOT NULL UNIQUE COMMENT 'College-issued Student ID (SID)',
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  mobile VARCHAR(15) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  department_id INT UNSIGNED NOT NULL,
  branch VARCHAR(100) NOT NULL COMMENT 'Specialization branch name',
  year TINYINT UNSIGNED NOT NULL COMMENT '1 to 4',
  semester TINYINT UNSIGNED NOT NULL COMMENT '1 to 8',
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  biometric_registered TINYINT(1) NOT NULL DEFAULT 0,
  profile_image_url VARCHAR(500),
  last_login TIMESTAMP NULL,
  rejected_reason TEXT,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE,
  INDEX idx_student_email (email),
  INDEX idx_student_dept (department_id),
  INDEX idx_student_status (status),
  INDEX idx_student_year_sem (year, semester)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: biometric_data
-- ============================================================
CREATE TABLE IF NOT EXISTS biometric_data (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL UNIQUE,
  face_descriptor JSON NOT NULL COMMENT 'face-api.js 128-dim descriptor array',
  face_image_url VARCHAR(500) NOT NULL COMMENT 'Primary reference image path',
  validation_image_url VARCHAR(500) COMMENT 'Second capture used for registration validation',
  similarity_score DECIMAL(5,2) COMMENT 'Score from registration validation comparison',
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_biometric_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_biometric_student (student_id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: geo_fencing_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS geo_fencing_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  college_name VARCHAR(200) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  radius_meters INT UNSIGNED NOT NULL DEFAULT 200,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  updated_by INT UNSIGNED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: attendance_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_name VARCHAR(50) NOT NULL UNIQUE COMMENT 'e.g. Morning, Afternoon',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_minutes TINYINT UNSIGNED NOT NULL DEFAULT 10,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  updated_by INT UNSIGNED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: holidays
-- ============================================================
CREATE TABLE IF NOT EXISTS holidays (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  holiday_date DATE NOT NULL,
  type ENUM('public','festival','college','emergency','exam') NOT NULL DEFAULT 'public',
  description TEXT,
  academic_year VARCHAR(20) COMMENT 'e.g. 2024-25',
  created_by INT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_holiday_date (holiday_date),
  INDEX idx_holiday_year (academic_year)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: working_days
-- ============================================================
CREATE TABLE IF NOT EXISTS working_days (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academic_year VARCHAR(20) NOT NULL COMMENT 'e.g. 2024-25',
  semester_label VARCHAR(50) COMMENT 'e.g. Even Semester 2025',
  semester_start DATE NOT NULL,
  semester_end DATE NOT NULL,
  working_days_json JSON COMMENT 'Array of working day names: ["Monday","Tuesday",...]',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wd_year (academic_year)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: attendance
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  attendance_date DATE NOT NULL,
  status ENUM('present','absent','leave','holiday','halfday') NOT NULL DEFAULT 'present',
  marked_at TIMESTAMP NULL,
  verified_by_face TINYINT(1) NOT NULL DEFAULT 0,
  verified_by_location TINYINT(1) NOT NULL DEFAULT 0,
  face_match_score DECIMAL(5,2) COMMENT 'Face similarity percentage',
  latitude DECIMAL(10,7) COMMENT 'Location at time of marking',
  longitude DECIMAL(10,7),
  device_info VARCHAR(500) COMMENT 'User agent string',
  ip_address VARCHAR(45),
  session VARCHAR(30) COMMENT 'Morning / Afternoon',
  is_manual TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Admin/Staff manual entry',
  marked_by_staff INT UNSIGNED COMMENT 'If manually entered by staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE KEY uq_student_date_session (student_id, attendance_date, session),
  INDEX idx_att_date (attendance_date),
  INDEX idx_att_student (student_id),
  INDEX idx_att_student_date (student_id, attendance_date)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: leave_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  leave_type ENUM('medical','personal','family','exam_duty','other') NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT NOT NULL,
  attachment_url VARCHAR(500),
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT UNSIGNED COMMENT 'Staff ID who reviewed',
  review_comment TEXT,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_leave_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_leave_student (student_id),
  INDEX idx_leave_status (status),
  INDEX idx_leave_dates (from_date, to_date)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  user_role ENUM('student','staff','admin') NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info','success','warning','danger') NOT NULL DEFAULT 'info',
  link VARCHAR(500) COMMENT 'Optional action link',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id, user_role),
  INDEX idx_notif_read (is_read),
  INDEX idx_notif_created (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: attendance_logs (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED,
  action VARCHAR(100) NOT NULL,
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_attlog_student (student_id),
  INDEX idx_attlog_action (action),
  INDEX idx_attlog_created (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: security_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS security_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED,
  user_role ENUM('student','staff','admin') NOT NULL,
  action VARCHAR(100) NOT NULL,
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status ENUM('success','failure','blocked') NOT NULL DEFAULT 'success',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_seclog_user (user_id, user_role),
  INDEX idx_seclog_action (action),
  INDEX idx_seclog_created (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default Departments (Tamil Nadu college standard)
INSERT IGNORE INTO departments (name, code, description) VALUES
  ('Computer Science and Engineering', 'CSE', 'B.E. / B.Tech Computer Science'),
  ('Electronics and Communication Engineering', 'ECE', 'B.E. Electronics and Communication'),
  ('Mechanical Engineering', 'MECH', 'B.E. Mechanical Engineering'),
  ('Civil Engineering', 'CIVIL', 'B.E. Civil Engineering'),
  ('Electrical and Electronics Engineering', 'EEE', 'B.E. Electrical and Electronics'),
  ('Information Technology', 'IT', 'B.Tech Information Technology'),
  ('Artificial Intelligence and Data Science', 'AIDS', 'B.Tech AI and Data Science'),
  ('Biotechnology Engineering', 'BT', 'B.Tech Biotechnology'),
  ('Chemical Engineering', 'CHEM', 'B.Tech Chemical Engineering'),
  ('Master of Business Administration', 'MBA', 'MBA Programme');

-- Default Geo-Fencing (PSG College of Technology, Coimbatore as example)
INSERT IGNORE INTO geo_fencing_settings (college_name, latitude, longitude, radius_meters) VALUES
  ('Smart College of Technology', 11.0168, 76.9558, 200);

-- Default Attendance Sessions
INSERT IGNORE INTO attendance_settings (session_name, start_time, end_time, grace_minutes) VALUES
  ('Morning', '09:00:00', '09:30:00', 10),
  ('Afternoon', '13:30:00', '14:00:00', 10),
  ('Evening', '17:00:00', '18:00:00', 10);

-- Default Working Days (2024-25 Even Semester)
INSERT IGNORE INTO working_days (academic_year, semester_label, semester_start, semester_end, working_days_json, is_active) VALUES
  ('2024-25', 'Even Semester 2025', '2025-01-01', '2025-05-31', '["Monday","Tuesday","Wednesday","Thursday","Friday"]', 1);

-- ============================================================
-- NOTE: Admin account is seeded via Node.js seed script
-- to ensure bcrypt hashing is applied correctly.
-- See: backend/src/database/seed.js
-- ============================================================
