const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

    pool = new Pool({
      connectionString,
      ssl: process.env.DB_HOST && process.env.DB_HOST.includes('supabase.co') 
        ? { rejectUnauthorized: false } 
        : false,
      max: 20,
      idleTimeoutMillis: 30000
    });
  }
  return pool;
}

function convertMySQLtoPG(sql) {
  let idx = 1;
  let pgSql = sql.replace(/\?/g, () => `$${idx++}`);
  
  // Auto-append RETURNING id for INSERT statements to simulate mysql's insertId
  if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
    pgSql += ' RETURNING id';
  }
  
  return pgSql;
}

async function query(sql, params = []) {
  const db = getPool();
  const pgSql = convertMySQLtoPG(sql);
  
  const result = await db.query(pgSql, params);
  
  // mysql2 returns [rows, fields] for SELECTs
  // for INSERT/UPDATE/DELETE, the first element is an info object: { affectedRows, insertId }
  if (['INSERT', 'UPDATE', 'DELETE'].includes(result.command)) {
    const meta = {
      affectedRows: result.rowCount,
      insertId: (result.rows && result.rows.length > 0 && result.rows[0].id) ? result.rows[0].id : null,
    };
    return [meta, result.fields];
  }

  return [result.rows, result.fields];
}

async function testConnection() {
  try {
    const db = getPool();
    await db.query('SELECT 1');
    console.log('[DB] PostgreSQL connection established successfully (Supabase).');
  } catch (err) {
    console.error('[DB] PostgreSQL connection failed:', err.message);
    throw err;
  }
}

module.exports = { query, getPool, testConnection };
