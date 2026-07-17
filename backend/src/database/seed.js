/**
 * Database Seed Script for Supabase PostgreSQL
 * Seeds the default admin account with bcrypt hashed password
 * Run: node src/database/seed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const db = require('../config/database');

const SALT_ROUNDS = 12;

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@college.edu';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = 'System Administrator';

  console.log('[Seed] Checking for existing admin account...');

  const [existing] = await db.query('SELECT id FROM admins WHERE email = ?', [adminEmail]);
  if (existing.length > 0) {
    console.log('[Seed] Admin account already exists. Skipping.');
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

  await db.query(
    'INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)',
    [adminName, adminEmail, passwordHash]
  );

  console.log(`[Seed] Admin account created: ${adminEmail}`);
}

async function seedDefaultStaff() {
  const [depts] = await db.query('SELECT id, code FROM departments LIMIT 1');
  if (!depts.length) return;

  const deptId = depts[0].id;
  const staffEmail = 'staff@college.edu';

  const [existing] = await db.query('SELECT id FROM faculty WHERE email = ?', [staffEmail]);
  if (existing.length > 0) {
    console.log('[Seed] Default staff already exists. Skipping.');
    return;
  }

  const passwordHash = await bcrypt.hash('staff123', 12);
  await db.query(
    'INSERT INTO faculty (employee_id, name, email, password_hash, phone, department_id, designation, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)',
    ['STF001', 'Dr. Priya Sharma', staffEmail, passwordHash, '9876543210', deptId, 'Assistant Professor']
  );

  console.log('[Seed] Default staff created: staff@college.edu (password: staff123)');
}

async function run() {
  try {
    await seedAdmin();
    await seedDefaultStaff();
    console.log('[Seed] Database seeding completed.');
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
  }
}

run();
