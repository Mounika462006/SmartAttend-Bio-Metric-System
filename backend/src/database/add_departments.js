/**
 * Database Migration: Seed Comprehensive Departments and Categories
 * Run: node src/database/add_departments.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');

const categoriesAndDepts = [
  // Engineering & Technology
  { name: 'Artificial Intelligence and Data Science (AI & DS)', code: 'AI-DS', category: 'engineering' },
  { name: 'Computer Science and Engineering (CSE)', code: 'CSE', category: 'engineering' },
  { name: 'Computer Science and Engineering (Artificial Intelligence)', code: 'CSE-AI', category: 'engineering' },
  { name: 'Computer Science and Engineering (Cyber Security)', code: 'CSE-CS', category: 'engineering' },
  { name: 'Information Technology (IT)', code: 'IT', category: 'engineering' },
  { name: 'Electronics and Communication Engineering (ECE)', code: 'ECE', category: 'engineering' },
  { name: 'Electrical and Electronics Engineering (EEE)', code: 'EEE', category: 'engineering' },
  { name: 'Mechanical Engineering (ME)', code: 'ME', category: 'engineering' },
  { name: 'Civil Engineering (CE)', code: 'CE', category: 'engineering' },
  { name: 'Chemical Engineering', code: 'CHEM', category: 'engineering' },
  { name: 'Biotechnology', code: 'BIOTECH-ENG', category: 'engineering' },
  { name: 'Biomedical Engineering', code: 'BME', category: 'engineering' },
  { name: 'Mechatronics Engineering', code: 'MCT', category: 'engineering' },
  { name: 'Robotics and Automation', code: 'ROBOTICS', category: 'engineering' },
  { name: 'Aeronautical Engineering', code: 'AERO', category: 'engineering' },
  { name: 'Automobile Engineering', code: 'AUTO', category: 'engineering' },
  { name: 'Agricultural Engineering', code: 'AGRI-ENG', category: 'engineering' },
  { name: 'Food Technology', code: 'FOOD-TECH', category: 'engineering' },
  { name: 'Textile Technology', code: 'TEXTILE', category: 'engineering' },
  { name: 'Production Engineering', code: 'PROD', category: 'engineering' },
  { name: 'Industrial Engineering', code: 'IND-ENG', category: 'engineering' },
  { name: 'Petroleum Engineering', code: 'PETRO', category: 'engineering' },
  { name: 'Marine Engineering', code: 'MARINE', category: 'engineering' },
  { name: 'Mining Engineering', code: 'MINING', category: 'engineering' },

  // Science
  { name: 'Physics', code: 'PHY', category: 'science' },
  { name: 'Chemistry', code: 'CHEMISTRY', category: 'science' },
  { name: 'Mathematics', code: 'MATH', category: 'science' },
  { name: 'Statistics', code: 'STATS', category: 'science' },
  { name: 'Computer Science', code: 'CS', category: 'science' },
  { name: 'Data Science', code: 'DS', category: 'science' },
  { name: 'Biotechnology (Science)', code: 'BIOTECH-SCI', category: 'science' },
  { name: 'Microbiology', code: 'MICRO', category: 'science' },
  { name: 'Environmental Science', code: 'EVS', category: 'science' },
  { name: 'Zoology', code: 'ZOOL', category: 'science' },
  { name: 'Botany', code: 'BOTANY', category: 'science' },

  // Arts & Humanities
  { name: 'English', code: 'ENG', category: 'arts' },
  { name: 'Tamil', code: 'TAMIL', category: 'arts' },
  { name: 'History', code: 'HIST', category: 'arts' },
  { name: 'Economics', code: 'ECON', category: 'arts' },
  { name: 'Political Science', code: 'POL-SCI', category: 'arts' },
  { name: 'Sociology', code: 'SOC', category: 'arts' },
  { name: 'Psychology', code: 'PSYCH', category: 'arts' },
  { name: 'Philosophy', code: 'PHIL', category: 'arts' },
  { name: 'Journalism and Mass Communication', code: 'JMC', category: 'arts' },
  { name: 'Fine Arts', code: 'FA', category: 'arts' },

  // Commerce & Management
  { name: 'Commerce (B.Com)', code: 'BCOM', category: 'commerce' },
  { name: 'Commerce with Computer Applications', code: 'BCOM-CA', category: 'commerce' },
  { name: 'Accounting and Finance', code: 'ACCT-FIN', category: 'commerce' },
  { name: 'Banking and Insurance', code: 'BANK-INS', category: 'commerce' },
  { name: 'Business Administration (BBA)', code: 'BBA', category: 'commerce' },
  { name: 'Master of Business Administration (MBA)', code: 'MBA', category: 'commerce' },
  { name: 'Business Analytics', code: 'BIZ-ANALYTICS', category: 'commerce' },
  { name: 'Human Resource Management', code: 'HRM', category: 'commerce' },
  { name: 'Marketing', code: 'MKTG', category: 'commerce' },
  { name: 'Finance', code: 'FINANCE', category: 'commerce' },

  // Medical & Health Sciences
  { name: 'MBBS', code: 'MBBS', category: 'medical' },
  { name: 'BDS (Dental)', code: 'BDS', category: 'medical' },
  { name: 'Nursing', code: 'NURSING', category: 'medical' },
  { name: 'Pharmacy (B.Pharm)', code: 'BPHARM', category: 'medical' },
  { name: 'Pharm.D', code: 'PHARMD', category: 'medical' },
  { name: 'Physiotherapy', code: 'BPT', category: 'medical' },
  { name: 'Occupational Therapy', code: 'BOT-MED', category: 'medical' },
  { name: 'Public Health', code: 'MPH', category: 'medical' },
  { name: 'Medical Laboratory Technology', code: 'MLT', category: 'medical' },

  // Law
  { name: 'Bachelor of Laws (LLB)', code: 'LLB', category: 'law' },
  { name: 'Integrated Law (BA LLB, BBA LLB)', code: 'INT-LAW', category: 'law' },
  { name: 'Master of Laws (LLM)', code: 'LLM', category: 'law' },

  // Education
  { name: 'Bachelor of Education (B.Ed)', code: 'BED', category: 'education' },
  { name: 'Master of Education (M.Ed)', code: 'MED', category: 'education' },

  // Agriculture
  { name: 'Agriculture', code: 'AGRICULTURE', category: 'agriculture' },
  { name: 'Horticulture', code: 'HORTI', category: 'agriculture' },
  { name: 'Forestry', code: 'FORESTRY', category: 'agriculture' },
  { name: 'Agricultural Biotechnology', code: 'AGRI-BIOTECH', category: 'agriculture' },
  { name: 'Agricultural Engineering (Agriculture)', code: 'AGRI-ENG-AG', category: 'agriculture' },

  // Computer Applications
  { name: 'Bachelor of Computer Applications (BCA)', code: 'BCA', category: 'computer_applications' },
  { name: 'Master of Computer Applications (MCA)', code: 'MCA', category: 'computer_applications' },

  // Architecture & Design
  { name: 'Architecture (B.Arch)', code: 'BARCH', category: 'architecture' },
  { name: 'Interior Design', code: 'ID-ARCH', category: 'architecture' },
  { name: 'Fashion Design', code: 'FD-ARCH', category: 'architecture' },
  { name: 'Graphic Design', code: 'GD-ARCH', category: 'architecture' },
  { name: 'Industrial Design', code: 'IND-DES', category: 'architecture' },

  // Vocational Studies
  { name: 'Hotel Management', code: 'HM', category: 'vocational' },
  { name: 'Catering Technology', code: 'CATERING', category: 'vocational' },
  { name: 'Tourism Management', code: 'TOURISM', category: 'vocational' },
  { name: 'Aviation Management', code: 'AVIATION', category: 'vocational' },
  { name: 'Event Management', code: 'EVENT', category: 'vocational' },
];

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL is missing.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Adding "category" column to "departments" if it doesn\'t exist...');
    await pool.query(`
      ALTER TABLE departments 
      ADD COLUMN IF NOT EXISTS category VARCHAR(50);
    `);

    console.log('Inserting departments...');
    for (const item of categoriesAndDepts) {
      await pool.query(`
        INSERT INTO departments (name, code, category, is_active)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name, category = EXCLUDED.category, is_active = TRUE;
      `, [item.name, item.code, item.category]);
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error during migration:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
