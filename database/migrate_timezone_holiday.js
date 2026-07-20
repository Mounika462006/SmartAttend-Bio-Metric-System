const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL not found in environment variables.');
    process.exit(1);
  }

  console.log('[Migration] Connecting to Supabase PostgreSQL...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[Migration] Connected. Starting alterations...');

    // 1. Alter holidays columns
    console.log('[Migration] Altering holidays columns...');
    await client.query(`
      DO $$
      BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='holidays' AND column_name='holiday_date') THEN
              ALTER TABLE holidays RENAME COLUMN holiday_date TO from_date;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='holidays' AND column_name='to_date') THEN
              ALTER TABLE holidays ADD COLUMN to_date DATE;
              UPDATE holidays SET to_date = from_date WHERE to_date IS NULL;
              ALTER TABLE holidays ALTER COLUMN to_date SET NOT NULL;
          END IF;
      END $$;
    `);

    // 2. Alter index for holidays date
    console.log('[Migration] Recreating holidays index...');
    await client.query(`
      DROP INDEX IF EXISTS idx_holiday_date;
      CREATE INDEX IF NOT EXISTS idx_holiday_date ON holidays (from_date);
    `);

    // 3. Alter timestamp columns to WITH TIME ZONE (TIMESTAMPTZ)
    const tablesToAlter = [
      { name: 'admins', cols: ['created_at', 'updated_at'] },
      { name: 'staff', cols: ['last_login', 'created_at', 'updated_at'] },
      { name: 'students', cols: ['last_login', 'created_at', 'updated_at'] },
      { name: 'departments', cols: ['created_at', 'updated_at'] },
      { name: 'working_days', cols: ['updated_at'] },
      { name: 'holidays', cols: ['created_at', 'updated_at'] },
      { name: 'attendance', cols: ['marked_at', 'created_at'] },
      { name: 'leave_requests', cols: ['reviewed_at', 'created_at', 'updated_at'] },
      { name: 'notifications', cols: ['created_at'] },
      { name: 'attendance_logs', cols: ['created_at'] },
      { name: 'security_logs', cols: ['created_at'] }
    ];

    for (const table of tablesToAlter) {
      console.log(`[Migration] Altering timestamps for table: ${table.name}...`);
      for (const col of table.cols) {
        // Alter column type to TIMESTAMP WITH TIME ZONE
        await client.query(`
          ALTER TABLE ${table.name} ALTER COLUMN ${col} TYPE TIMESTAMP WITH TIME ZONE;
        `);
      }
    }

    console.log('🎉 [Migration] Database migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ [Migration] Error during migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
