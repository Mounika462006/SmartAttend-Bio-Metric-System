-- ============================================================
-- Smart Face Biometric Attendance System - PostgreSQL Schema
-- For Supabase
-- ============================================================

-- ============================================================
-- TABLE: departments
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dept_code ON departments (code);
CREATE INDEX IF NOT EXISTS idx_dept_active ON departments (is_active);

-- ============================================================
-- TABLE: admins
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_email ON admins (email);

-- ============================================================
-- TABLE: staff
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  mobile VARCHAR(15),
  department_id INT NOT NULL,
  designation VARCHAR(80),
  is_active SMALLINT NOT NULL DEFAULT 1,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_staff_email ON staff (email);
CREATE INDEX IF NOT EXISTS idx_staff_dept ON staff (department_id);

-- ============================================================
-- TABLE: students
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id VARCHAR(30) NOT NULL UNIQUE, -- College-issued Student ID (SID)
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  mobile VARCHAR(15) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  department_id INT NOT NULL,
  branch VARCHAR(100) NOT NULL, -- Specialization branch name
  year SMALLINT NOT NULL, -- 1 to 4
  semester SMALLINT NOT NULL, -- 1 to 8
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  biometric_registered SMALLINT NOT NULL DEFAULT 0,
  profile_image_url VARCHAR(500),
  last_login TIMESTAMP NULL,
  rejected_reason TEXT,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_student_email ON students (email);
CREATE INDEX IF NOT EXISTS idx_student_dept ON students (department_id);
CREATE INDEX IF NOT EXISTS idx_student_status ON students (status);
CREATE INDEX IF NOT EXISTS idx_student_year_sem ON students (year, semester);

-- ============================================================
-- TABLE: biometric_data
-- ============================================================
CREATE TABLE IF NOT EXISTS biometric_data (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id INT NOT NULL UNIQUE,
  face_descriptor JSONB NOT NULL, -- face-api.js 128-dim descriptor array
  face_image_url VARCHAR(500) NOT NULL, -- Primary reference image path
  validation_image_url VARCHAR(500), -- Second capture used for registration validation
  similarity_score DECIMAL(5,2), -- Score from registration validation comparison
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_biometric_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_biometric_student ON biometric_data (student_id);

-- ============================================================
-- TABLE: geo_fencing_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS geo_fencing_settings (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  college_name VARCHAR(200) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  radius_meters INT NOT NULL DEFAULT 200,
  is_active SMALLINT NOT NULL DEFAULT 1,
  updated_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: attendance_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_settings (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_name VARCHAR(50) NOT NULL UNIQUE, -- e.g. Morning, Afternoon
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_minutes SMALLINT NOT NULL DEFAULT 10,
  is_active SMALLINT NOT NULL DEFAULT 1,
  updated_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: holidays
-- ============================================================
CREATE TABLE IF NOT EXISTS holidays (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  holiday_date DATE NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (type IN ('public','festival','college','emergency','exam')),
  description TEXT,
  academic_year VARCHAR(20), -- e.g. 2024-25
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_holiday_date ON holidays (holiday_date);
CREATE INDEX IF NOT EXISTS idx_holiday_year ON holidays (academic_year);

-- ============================================================
-- TABLE: working_days
-- ============================================================
CREATE TABLE IF NOT EXISTS working_days (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  academic_year VARCHAR(20) NOT NULL, -- e.g. 2024-25
  semester_label VARCHAR(50), -- e.g. Even Semester 2025
  semester_start DATE NOT NULL,
  semester_end DATE NOT NULL,
  working_days_json JSONB, -- Array of working day names: ["Monday","Tuesday",...]
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wd_year ON working_days (academic_year);

-- ============================================================
-- TABLE: attendance
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','leave','holiday','halfday')),
  marked_at TIMESTAMP NULL,
  verified_by_face SMALLINT NOT NULL DEFAULT 0,
  verified_by_location SMALLINT NOT NULL DEFAULT 0,
  face_match_score DECIMAL(5,2), -- Face similarity percentage
  latitude DECIMAL(10,7), -- Location at time of marking
  longitude DECIMAL(10,7),
  device_info VARCHAR(500), -- User agent string
  ip_address VARCHAR(45),
  session VARCHAR(30), -- Morning / Afternoon
  is_manual SMALLINT NOT NULL DEFAULT 0, -- Admin/Staff manual entry
  marked_by_staff INT, -- If manually entered by staff
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT uq_student_date_session UNIQUE (student_id, attendance_date, session)
);

CREATE INDEX IF NOT EXISTS idx_att_date ON attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_att_student ON attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_att_student_date ON attendance (student_id, attendance_date);

-- ============================================================
-- TABLE: leave_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id INT NOT NULL,
  leave_type VARCHAR(20) NOT NULL CHECK (leave_type IN ('medical','personal','family','exam_duty','other')),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT NOT NULL,
  attachment_url VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by INT, -- Staff ID who reviewed
  review_comment TEXT,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_leave_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leave_student ON leave_requests (student_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests (status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON leave_requests (from_date, to_date);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL,
  user_role VARCHAR(20) NOT NULL CHECK (user_role IN ('student','staff','admin')),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','danger')),
  link VARCHAR(500), -- Optional action link
  is_read SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications (user_id, user_role);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications (created_at);

-- ============================================================
-- TABLE: attendance_logs (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_logs (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id INT,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attlog_student ON attendance_logs (student_id);
CREATE INDEX IF NOT EXISTS idx_attlog_action ON attendance_logs (action);
CREATE INDEX IF NOT EXISTS idx_attlog_created ON attendance_logs (created_at);

-- ============================================================
-- TABLE: security_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS security_logs (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT,
  user_role VARCHAR(20) NOT NULL CHECK (user_role IN ('student','staff','admin')),
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success','failure','blocked')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seclog_user ON security_logs (user_id, user_role);
CREATE INDEX IF NOT EXISTS idx_seclog_action ON security_logs (action);
CREATE INDEX IF NOT EXISTS idx_seclog_created ON security_logs (created_at);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default Departments (Tamil Nadu college standard)
INSERT INTO departments (name, code, description) VALUES
  ('Computer Science and Engineering', 'CSE', 'B.E. / B.Tech Computer Science'),
  ('Electronics and Communication Engineering', 'ECE', 'B.E. Electronics and Communication'),
  ('Mechanical Engineering', 'MECH', 'B.E. Mechanical Engineering'),
  ('Civil Engineering', 'CIVIL', 'B.E. Civil Engineering'),
  ('Electrical and Electronics Engineering', 'EEE', 'B.E. Electrical and Electronics'),
  ('Information Technology', 'IT', 'B.Tech Information Technology'),
  ('Artificial Intelligence and Data Science', 'AIDS', 'B.Tech AI and Data Science'),
  ('Biotechnology Engineering', 'BT', 'B.Tech Biotechnology'),
  ('Chemical Engineering', 'CHEM', 'B.Tech Chemical Engineering'),
  ('Master of Business Administration', 'MBA', 'MBA Programme')
ON CONFLICT (code) DO NOTHING;

-- Default Geo-Fencing (PSG College of Technology, Coimbatore as example)
-- Since we don't have a unique constraint besides ID, we will just insert it if the table is empty (handled by app or we can just insert)
-- Actually, ON CONFLICT requires a unique constraint. We'll just INSERT. If run multiple times, it might duplicate, but for a fresh DB it's fine.
INSERT INTO geo_fencing_settings (college_name, latitude, longitude, radius_meters) VALUES
  ('Smart College of Technology', 11.0168, 76.9558, 200);

-- Default Attendance Sessions
INSERT INTO attendance_settings (session_name, start_time, end_time, grace_minutes) VALUES
  ('Morning', '09:00:00', '09:30:00', 10),
  ('Afternoon', '13:30:00', '14:00:00', 10),
  ('Evening', '17:00:00', '18:00:00', 10)
ON CONFLICT (session_name) DO NOTHING;

-- Default Working Days (2024-25 Even Semester)
INSERT INTO working_days (academic_year, semester_label, semester_start, semester_end, working_days_json, is_active) VALUES
  ('2024-25', 'Even Semester 2025', '2025-01-01', '2025-05-31', '["Monday","Tuesday","Wednesday","Thursday","Friday"]', 1);
