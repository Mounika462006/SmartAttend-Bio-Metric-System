/**
 * Database Initialization Script
 * Creates the database if it doesn't exist, imports the schema, and seeds default accounts.
 * Run: node src/database/init.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function run() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD === 'your_mysql_password' ? '' : (process.env.DB_PASSWORD || '');
  const dbName = process.env.DB_NAME || 'smart_attendance_db';

  console.log('[Init] Connecting to MySQL server to check/create database...');
  
  let connection;
  try {
    // Connect without specifying a database first
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true // Allow running the schema file as a batch
    });
  } catch (err) {
    console.error('[Init] Error: Could not connect to MySQL server.');
    console.error(`Please verify that your database credentials in backend/.env are correct.`);
    console.error(`Current config - Host: ${host}, Port: ${port}, User: ${user}`);
    console.error(`Error details: ${err.message}`);
    process.exit(1);
  }

  try {
    // 1. Create database
    console.log(`[Init] Creating database '${dbName}' if not exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${dbName}\`;`);
    
    // 2. Read and execute schema.sql (contains tables, indexes, constraints, and default data)
    console.log('[Init] Reading schema.sql...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('[Init] Executing schema SQL statements (creating tables & constraints)...');
    // Using multipleStatements: true allows us to run the whole schema.sql file in one query
    await connection.query(schemaSql);
    console.log('[Init] Database schema imported successfully.');

    // Migration helper: check and add branch column if it doesn't exist (since tables might already exist)
    console.log('[Init] Checking if students table needs branch column migration...');
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'students' AND COLUMN_NAME = 'branch'`,
      [dbName]
    );
    if (cols.length === 0) {
      console.log('[Init] Migrating database: Adding branch column to students table...');
      await connection.query(
        `ALTER TABLE students ADD COLUMN branch VARCHAR(100) NOT NULL COMMENT 'Specialization branch name' AFTER department_id;`
      );
      console.log('[Init] Migration successful: branch column added.');
    }

    // Migration helper: check and add is_active column to students table if it doesn't exist
    console.log('[Init] Checking if students table needs is_active column migration...');
    const [activeCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'students' AND COLUMN_NAME = 'is_active'`,
      [dbName]
    );
    if (activeCols.length === 0) {
      console.log('[Init] Migrating database: Adding is_active column to students table...');
      await connection.query(
        `ALTER TABLE students ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER rejected_reason;`
      );
      console.log('[Init] Migration successful: is_active column added.');
    }

    // 3. Seed Admin and Staff
    console.log('[Init] Seeding default admin and staff credentials...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@college.edu';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = 'System Administrator';

    // Seed Admin
    const [existingAdmin] = await connection.query('SELECT id FROM admins WHERE email = ?', [adminEmail]);
    if (existingAdmin.length === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await connection.query(
        'INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)',
        [adminName, adminEmail, passwordHash]
      );
      console.log(`[Init] Admin account seeded: ${adminEmail} (password: ${adminPassword})`);
    } else {
      console.log('[Init] Admin account already exists. Skipping.');
    }

    // Seed Staff
    const [depts] = await connection.query('SELECT id, code FROM departments LIMIT 1');
    if (depts.length > 0) {
      const deptId = depts[0].id;
      const staffEmail = 'staff@college.edu';
      const [existingStaff] = await connection.query('SELECT id FROM staff WHERE email = ?', [staffEmail]);
      if (existingStaff.length === 0) {
        const passwordHash = await bcrypt.hash('staff123', 12);
        await connection.query(
          'INSERT INTO staff (staff_id, name, email, password_hash, mobile, department_id, designation) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['STF001', 'Dr. Priya Sharma', staffEmail, passwordHash, '9876543210', deptId, 'Assistant Professor']
        );
        console.log(`[Init] Default staff seeded: ${staffEmail} (password: staff123)`);
      } else {
        console.log('[Init] Default staff already exists. Skipping.');
      }
    }

    console.log('[Init] Database initialization and seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[Init] Error during database initialization:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run();
