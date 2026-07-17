const { Pool } = require('pg');
require('dotenv').config();

const sql = `
-- Add approved and rejected values to student_status enum if they don't exist
ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'rejected';
`;

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('[Migration] Adding "approved" and "rejected" to student_status enum...');
    await pool.query(sql);
    console.log('[Migration] Success! Enum values added.');
  } catch (err) {
    console.error('[Migration] Failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();
