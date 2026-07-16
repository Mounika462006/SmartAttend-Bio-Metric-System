-- ============================================================
-- Smart Face Biometric Attendance System - PostgreSQL Schema
-- Compatible with Supabase PostgreSQL
-- ============================================================

-- Drop tables first if they exist to avoid constraint/type reference errors
DROP TABLE IF EXISTS security_logs CASCADE;
DROP TABLE IF EXISTS attendance_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS working_days CASCADE;
DROP TABLE IF EXISTS holidays CASCADE;
DROP TABLE IF EXISTS attendance_settings CASCADE;
DROP TABLE IF EXISTS geo_fencing_settings CASCADE;
DROP TABLE IF EXISTS biometric_data CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS student_status CASCADE;
DROP TYPE IF EXISTS holiday_type CASCADE;
DROP TYPE IF EXISTS attendance_status CASCADE;
DROP TYPE IF EXISTS leave_type CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS security_log_status CASCADE;

-- Create custom ENUM types
CREATE TYPE student_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE holiday_type AS ENUM ('public', 'festival', 'college', 'emergency', 'exam');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'leave', 'holiday', 'halfday');
CREATE TYPE leave_type AS ENUM ('medical', 'personal', 'family', 'exam_duty', 'other');
CREATE TYPE user_role AS ENUM ('student', 'staff', 'admin');
CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'danger');
CREATE TYPE security_log_status AS ENUM ('success', 'failure', 'blocked');

-- ============================================================
-- TABLE: departments
-- ============================================================
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: admins
-- ============================================================
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: staff
-- ============================================================
CREATE TABLE staff (
  id SERIAL PRIMARY KEY,
  staff_id VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  mobile VARCHAR(15),
  department_id INTEGER NOT NULL REFERENCES departments(id) ON UPDATE CASCADE,
  designation VARCHAR(80),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: students
-- ============================================================
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  mobile VARCHAR(15) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON UPDATE CASCADE,
  branch VARCHAR(100) NOT NULL,
  year SMALLINT NOT NULL,
  semester SMALLINT NOT NULL,
  status student_status NOT NULL DEFAULT 'pending',
  biometric_registered BOOLEAN NOT NULL DEFAULT FALSE,
  profile_image_url VARCHAR(500),
  last_login TIMESTAMP NULL,
  rejected_reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: biometric_data
-- ============================================================
CREATE TABLE biometric_data (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  face_descriptor JSONB NOT NULL,
  face_image_url VARCHAR(500) NOT NULL,
  validation_image_url VARCHAR(500),
  similarity_score DECIMAL(5,2),
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: geo_fencing_settings
-- ============================================================
CREATE TABLE geo_fencing_settings (
  id SERIAL PRIMARY KEY,
  college_name VARCHAR(200) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 200,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: attendance_settings
-- ============================================================
CREATE TABLE attendance_settings (
  id SERIAL PRIMARY KEY,
  session_name VARCHAR(50) NOT NULL UNIQUE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_minutes SMALLINT NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: holidays
-- ============================================================
CREATE TABLE holidays (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  holiday_date DATE NOT NULL,
  type holiday_type NOT NULL DEFAULT 'public',
  description TEXT,
  academic_year VARCHAR(20),
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: working_days
-- ============================================================
CREATE TABLE working_days (
  id SERIAL PRIMARY KEY,
  academic_year VARCHAR(20) NOT NULL,
  semester_label VARCHAR(50),
  semester_start DATE NOT NULL,
  semester_end DATE NOT NULL,
  working_days_json JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: attendance
-- ============================================================
CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'present',
  marked_at TIMESTAMP NULL,
  verified_by_face BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by_location BOOLEAN NOT NULL DEFAULT FALSE,
  face_match_score DECIMAL(5,2),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  device_info VARCHAR(500),
  ip_address VARCHAR(45),
  session VARCHAR(30),
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  marked_by_staff INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_student_date_session UNIQUE (student_id, attendance_date, session)
);

-- ============================================================
-- TABLE: leave_requests
-- ============================================================
CREATE TABLE leave_requests (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  leave_type leave_type NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT NOT NULL,
  attachment_url VARCHAR(500),
  status student_status NOT NULL DEFAULT 'pending',
  reviewed_by INTEGER,
  review_comment TEXT,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  user_role user_role NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type notification_type NOT NULL DEFAULT 'info',
  link VARCHAR(500),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: attendance_logs (audit trail)
-- ============================================================
CREATE TABLE attendance_logs (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: security_logs
-- ============================================================
CREATE TABLE security_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  user_role user_role NOT NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status security_log_status NOT NULL DEFAULT 'success',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ON UPDATE CURRENT_TIMESTAMP TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_departments_modtime BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admins_modtime BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_modtime BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_students_modtime BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_biometric_data_modtime BEFORE UPDATE ON biometric_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_geo_fencing_settings_modtime BEFORE UPDATE ON geo_fencing_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_settings_modtime BEFORE UPDATE ON attendance_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_holidays_modtime BEFORE UPDATE ON holidays FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_working_days_modtime BEFORE UPDATE ON working_days FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_requests_modtime BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX idx_dept_code ON departments (code);
CREATE INDEX idx_dept_active ON departments (is_active);
CREATE INDEX idx_admin_email ON admins (email);
CREATE INDEX idx_staff_email ON staff (email);
CREATE INDEX idx_staff_dept ON staff (department_id);
CREATE INDEX idx_student_email ON students (email);
CREATE INDEX idx_student_dept ON students (department_id);
CREATE INDEX idx_student_status ON students (status);
CREATE INDEX idx_student_year_sem ON students (year, semester);
CREATE INDEX idx_biometric_student ON biometric_data (student_id);
CREATE INDEX idx_holiday_date ON holidays (holiday_date);
CREATE INDEX idx_holiday_year ON holidays (academic_year);
CREATE INDEX idx_wd_year ON working_days (academic_year);
CREATE INDEX idx_att_date ON attendance (attendance_date);
CREATE INDEX idx_att_student ON attendance (student_id);
CREATE INDEX idx_att_student_date ON attendance (student_id, attendance_date);
CREATE INDEX idx_leave_student ON leave_requests (student_id);
CREATE INDEX idx_leave_status ON leave_requests (status);
CREATE INDEX idx_leave_dates ON leave_requests (from_date, to_date);
CREATE INDEX idx_notif_user ON notifications (user_id, user_role);
CREATE INDEX idx_notif_read ON notifications (is_read);
CREATE INDEX idx_notif_created ON notifications (created_at);
CREATE INDEX idx_attlog_student ON attendance_logs (student_id);
CREATE INDEX idx_attlog_action ON attendance_logs (action);
CREATE INDEX idx_attlog_created ON attendance_logs (created_at);
CREATE INDEX idx_seclog_user ON security_logs (user_id, user_role);
CREATE INDEX idx_seclog_action ON security_logs (action);
CREATE INDEX idx_seclog_created ON security_logs (created_at);

-- ============================================================
-- SEED DATA
-- ============================================================
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

INSERT INTO geo_fencing_settings (college_name, latitude, longitude, radius_meters) VALUES
  ('Smart College of Technology', 11.0168, 76.9558, 200);

INSERT INTO attendance_settings (session_name, start_time, end_time, grace_minutes) VALUES
  ('Morning', '09:00:00', '09:30:00', 10),
  ('Afternoon', '13:30:00', '14:00:00', 10),
  ('Evening', '17:00:00', '18:00:00', 10)
  ON CONFLICT (session_name) DO NOTHING;

INSERT INTO working_days (academic_year, semester_label, semester_start, semester_end, working_days_json, is_active) VALUES
  ('2024-25', 'Even Semester 2025', '2025-01-01', '2025-05-31', '["Monday","Tuesday","Wednesday","Thursday","Friday"]'::jsonb, TRUE);
