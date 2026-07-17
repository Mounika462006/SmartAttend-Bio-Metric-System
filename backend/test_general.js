const { getPool } = require('./src/config/database');
require('dotenv').config();

async function run() {
  const pool = getPool();
  try {
    console.log('Testing primary SELECT query...');
    const [rows] = await pool.query('SELECT id, name, code, category FROM departments WHERE is_active = TRUE ORDER BY name');
    console.log('Success! Rows returned:', rows.rows.length);
    console.log('First row sample:', rows.rows[0]);
  } catch (err) {
    console.error('Primary query failed:', err.message);
    try {
      console.log('Testing fallback SELECT query...');
      const [rows] = await pool.query('SELECT id, name, code FROM departments WHERE is_active = TRUE ORDER BY name');
      console.log('Success! Fallback rows returned:', rows.rows.length);
      console.log('First fallback row sample:', rows.rows[0]);
    } catch (fallbackErr) {
      console.error('Fallback query failed:', fallbackErr.message);
    }
  }
  process.exit(0);
}

run();
