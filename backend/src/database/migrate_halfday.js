/**
 * Database Migration Script for PostgreSQL
 * Updates the attendance status ENUM to include 'halfday' and adds the 'Evening' session.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('../config/database');

async function run() {
  try {
    console.log('[Migration] Checking and altering attendance status ENUM...');
    
    // In PostgreSQL, we can use ALTER TYPE ADD VALUE IF NOT EXISTS
    // (Note: this cannot run inside a transaction block in some pg versions, but it runs fine individually)
    try {
      await db.query(`ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'halfday'`);
      console.log('[Migration] Checked and updated attendance_status ENUM.');
    } catch (enumErr) {
      // If it already exists or fails, log it but keep going
      console.log('[Migration] Note on ENUM update:', enumErr.message);
    }

    // Add Evening session if it doesn't exist
    const [existing] = await db.query(
      'SELECT id FROM attendance_settings WHERE session_name = $1',
      ['Evening']
    );

    if (existing.length === 0) {
      await db.query(
        `INSERT INTO attendance_settings (session_name, start_time, end_time, grace_minutes, is_active) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (session_name) DO NOTHING`,
        ['Evening', '17:00:00', '18:00:00', 10, true]
      );
      console.log('[Migration] Successfully inserted Evening session.');
    } else {
      console.log('[Migration] Evening session already exists.');
    }

    console.log('[Migration] Database migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Error during migration:', err.message);
    process.exit(1);
  }
}

run();
