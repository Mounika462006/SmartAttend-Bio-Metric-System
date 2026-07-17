const db = require('./src/config/database');
require('dotenv').config();

async function run() {
  try {
    const studentId = '4c37ea22-7ef9-4896-985f-7cd34ab2bba9';
    const [rows] = await db.query('SELECT name, email, status, biometric_registered FROM students WHERE id = ?', [studentId]);
    console.log('Student status:', rows[0]);
  } catch (err) {
    console.error('Query failed:', err.message);
  }
  process.exit(0);
}

run();
