/**
 * Database Initialization Script (PostgreSQL / Supabase)
 * Creates tables, indexes, constraints, and seeds default accounts.
 * Run: node src/database/init.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getPool, query } = require('../config/database');

async function run() {
  console.log('[Init] Connecting to PostgreSQL (Supabase)...');
  
  const pool = getPool();

  try {
    // 1. Read and execute supabase_schema.sql (contains tables, indexes, constraints, and default data)
    console.log('[Init] Reading supabase_schema.sql...');
    const schemaPath = path.join(__dirname, 'supabase_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('[Init] Executing schema SQL statements...');
    // pg supports multiple statements if no parameters are passed
    await pool.query(schemaSql);
    console.log('[Init] Database schema imported successfully.');

    // 2. Seed Admin and Staff
    console.log('[Init] Seeding default admin and staff credentials...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@college.edu';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = 'System Administrator';

    // Seed Admin
    const { rows: existingAdmin } = await pool.query('SELECT id FROM admins WHERE email = $1', [adminEmail]);
    if (existingAdmin.length === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await pool.query(
        'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3)',
        [adminName, adminEmail, passwordHash]
      );
      console.log(`[Init] Admin account seeded: ${adminEmail} (password: ${adminPassword})`);
    } else {
      console.log('[Init] Admin account already exists. Skipping.');
    }

    // Seed Staff
    const { rows: depts } = await pool.query('SELECT id, code FROM departments LIMIT 1');
    if (depts.length > 0) {
      const deptId = depts[0].id;
      const staffEmail = 'staff@college.edu';
      const { rows: existingStaff } = await pool.query('SELECT id FROM staff WHERE email = $1', [staffEmail]);
      if (existingStaff.length === 0) {
        const passwordHash = await bcrypt.hash('staff123', 12);
        await pool.query(
          'INSERT INTO staff (staff_id, name, email, password_hash, mobile, department_id, designation) VALUES ($1, $2, $3, $4, $5, $6, $7)',
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
    if (pool) {
      await pool.end();
    }
  }
}

run();
