const { Pool } = require('pg');
require('dotenv').config();

const sql = `
-- 1. Add user_id, user_role, type to notifications table
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS user_role VARCHAR(50),
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'info';

-- 2. Make target_audience column nullable so inserts from the application code don't fail
ALTER TABLE notifications ALTER COLUMN target_audience DROP NOT NULL;
`;

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('[Migration] Altering notifications table...');
    await pool.query(sql);
    console.log('[Migration] Success! Notifications table aligned with application code.');
  } catch (err) {
    console.error('[Migration] Failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();
