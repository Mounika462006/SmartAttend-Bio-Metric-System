require('dotenv').config();
const db = require('./src/config/database');

async function run() {
  try {
    const [att] = await db.query(`
      SELECT a.*, s.name, s.email 
      FROM attendance a
      JOIN students s ON a.student_id = s.id
    `);
    console.log('All attendance records with student names:');
    console.log(att);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
