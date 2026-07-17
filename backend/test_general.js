// Temporary test script. Can be used to check general DB connections.
const db = require('./src/config/database');
require('dotenv').config();

async function run() {
  try {
    await db.testConnection();
    console.log('Database connection OK!');
  } catch (err) {
    console.error('Connection test failed:', err.message);
  }
  process.exit(0);
}

run();
