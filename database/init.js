/**
 * Database Initialization Script for Supabase PostgreSQL
 * Creates tables, triggers, indexes, and seeds default accounts.
 * Run: node src/database/init.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[Init] Error: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  console.log('[Init] Connecting to Supabase PostgreSQL database...');
  
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // 1. Read and execute schema_postgres.sql
    console.log('[Init] Reading schema_postgres.sql...');
    const schemaPath = path.join(__dirname, 'schema_postgres.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('[Init] Executing schema SQL statements (creating tables, triggers & indexes)...');
    // For pg, we can execute multiple statements in a single pool.query() call
    await pool.query(schemaSql);
    console.log('[Init] Database schema imported successfully.');

    // 2. Seed Admin and Staff
    console.log('[Init] Seeding default admin and staff credentials...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@college.edu';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = 'System Administrator';

    // Seed Admin
    const existingAdminRes = await pool.query('SELECT id FROM admins WHERE email = $1', [adminEmail]);
    if (existingAdminRes.rows.length === 0) {
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
    const deptsRes = await pool.query('SELECT id, code FROM departments LIMIT 1');
    if (deptsRes.rows.length > 0) {
      const deptId = deptsRes.rows[0].id;
      const staffEmail = 'staff@college.edu';
      const existingStaffRes = await pool.query('SELECT id FROM staff WHERE email = $1', [staffEmail]);
      if (existingStaffRes.rows.length === 0) {
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
    await pool.end();
  }
}

run();
