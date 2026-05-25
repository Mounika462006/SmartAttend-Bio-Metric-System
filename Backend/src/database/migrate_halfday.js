/**
 * Database Migration Script
 * Updates the attendance status ENUM to include 'halfday' and adds the 'Evening' session.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('../config/database');

async function run() {
  try {
    console.log('[Migration] Checking and altering attendance status ENUM...');
    
    // Modify status ENUM in attendance table
    await db.query(
      `ALTER TABLE attendance 
       MODIFY COLUMN status ENUM('present', 'absent', 'leave', 'holiday', 'halfday') 
       NOT NULL DEFAULT 'present'`
    );
    console.log('[Migration] Successfully altered attendance table status column.');

    // Add Evening session if it doesn't exist
    const [existing] = await db.query(
      'SELECT id FROM attendance_settings WHERE session_name = ?',
      ['Evening']
    );

    if (existing.length === 0) {
      await db.query(
        `INSERT INTO attendance_settings (session_name, start_time, end_time, grace_minutes, is_active) 
         VALUES (?, ?, ?, ?, ?)`,
        ['Evening', '17:00:00', '18:00:00', 10, 1]
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
