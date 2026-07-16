const db = require('./src/config/database');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function check() {
  try {
    const [admins] = await db.query('SELECT email, password_hash FROM admins');
    for (const a of admins) {
      const match = await bcrypt.compare('admin123', a.password_hash);
      console.log(`Admin ${a.email} match for "admin123":`, match);
    }

    const [staff] = await db.query('SELECT email, password_hash FROM staff');
    for (const s of staff) {
      const match123 = await bcrypt.compare('staff123', s.password_hash);
      const matchVarsha = await bcrypt.compare('staff@123', s.password_hash);
      console.log(`Staff ${s.email} match for "staff123":`, match123, 'for "staff@123":', matchVarsha);
    }

    const [students] = await db.query('SELECT email, password_hash FROM students');
    for (const s of students) {
      const match123 = await bcrypt.compare('student123', s.password_hash);
      const matchStud123 = await bcrypt.compare('student@123', s.password_hash);
      console.log(`Student ${s.email} match for "student123":`, match123, 'for "student@123":', matchStud123);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
