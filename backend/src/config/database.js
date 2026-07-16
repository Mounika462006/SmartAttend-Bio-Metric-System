const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME || 'smart_attendance_db',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      timezone: '+05:30',
      charset: 'utf8mb4',
    });
  }
  return pool;
}

async function query(sql, params) {
  const db = getPool();
  return db.query(sql, params);
}

async function testConnection() {
  try {
    const db = getPool();
    await db.query('SELECT 1');
    console.log('[DB] MySQL connection established successfully.');
  } catch (err) {
    console.error('[DB] MySQL connection failed:', err.message);
    throw err;
  }
}

module.exports = { query, getPool, testConnection };
