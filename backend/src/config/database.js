const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 10000, // Wait up to 10 seconds for a connection
      idleTimeoutMillis: 30000,       // Close idle clients after 30 seconds
      max: 20,                         // Maintain up to 20 clients in the pool
      keepAlive: true                  // Enable TCP Keep-Alive to maintain socket connection
    });

    // Gracefully handle unexpected connection errors on idle clients to prevent backend process crashes
    pool.on('error', (err) => {
      console.error('[DB Pool Warning] Unexpected error on idle database client:', err.message);
    });
  }
  return pool;
}

// Convert MySQL SQL and params to PostgreSQL compatible SQL and params
function convertQuery(sql, params = []) {
  let pgSql = sql;
  const pgParams = [];
  let paramCount = 0;

  // Split by '?' placeholder
  const parts = sql.split('?');
  let newSql = parts[0];

  for (let i = 0; i < parts.length - 1; i++) {
    const param = params[i];
    const beforePart = parts[i].trim();
    const isInsideInClause = beforePart.toLowerCase().endsWith('in (') || beforePart.toLowerCase().endsWith('in(');

    if (Array.isArray(param) && isInsideInClause) {
      const match = beforePart.match(/in\s*\($/i);
      if (match) {
        const index = match.index;
        // Replace "IN (" with "= ANY($x)"
        newSql = newSql.substring(0, newSql.length - (beforePart.length - index)) + '= ANY($' + (++paramCount) + ')';
        // Strip closing parenthesis in the next segment
        parts[i+1] = parts[i+1].replace(/\)/, '');
      } else {
        const placeholders = param.map(() => `$${++paramCount}`).join(',');
        newSql += placeholders;
      }
      pgParams.push(param);
    } else if (Array.isArray(param)) {
      const placeholders = param.map(() => `$${++paramCount}`).join(',');
      newSql += placeholders;
      pgParams.push(...param);
    } else {
      newSql += `$${++paramCount}`;
      // Map true/false booleans correctly if passed
      pgParams.push(param);
    }
    newSql += parts[i+1];
  }

  // Replace MySQL specific SQL functions
  newSql = newSql.replace(/CURDATE\(\)/gi, 'CURRENT_DATE');
  
  // Note: PostgreSQL has NOW() natively, so we keep NOW() or convert it to CURRENT_TIMESTAMP
  // Standardize NOW() to CURRENT_TIMESTAMP for compatibility
  newSql = newSql.replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP');

  // Replace MySQL backticks with double quotes for identifier quoting
  newSql = newSql.replace(/`([^`]+)`/g, '"$1"');

  // Handle PostgreSQL upsert syntax replacements if they appear in raw sql
  // (We also update these manually in files, but let's make sure it handles ON DUPLICATE KEY)
  if (newSql.toLowerCase().includes('on duplicate key update')) {
    // E.g., ON DUPLICATE KEY UPDATE status = 'leave'
    // -> ON CONFLICT (student_id, attendance_date, session) DO UPDATE SET status = 'leave'
    newSql = newSql.replace(
      /on duplicate key update/gi,
      'ON CONFLICT (student_id, attendance_date, session) DO UPDATE SET'
    );
  }

  return { sql: newSql, params: pgParams };
}

async function query(sql, params = []) {
  const client = getPool();
  let { sql: pgSql, params: pgParams } = convertQuery(sql, params);

  const isSelect = /^\s*(select|show|describe|with)/i.test(pgSql);
  const isInsert = /^\s*insert\s+into/i.test(pgSql);

  // If insert, append RETURNING id to get the insertId
  if (isInsert && !/returning/i.test(pgSql)) {
    pgSql += ' RETURNING id';
  }

  try {
    const res = await client.query(pgSql, pgParams);

    if (isSelect) {
      // In mysql2, query returns [rows, fields]
      return [res.rows, res.fields];
    } else {
      // In mysql2, non-select queries return [OkPacket, null]
      const insertId = res.rows && res.rows.length > 0 ? (res.rows[0].id || res.rows[0].insertid) : null;
      const mockResult = {
        insertId: insertId ? Number(insertId) : null,
        affectedRows: res.rowCount,
        warningCount: 0,
        message: '',
        protocol41: true,
        changedRows: res.rowCount
      };
      return [mockResult, null];
    }
  } catch (err) {
    console.error(`[DB Query Error] SQL: ${pgSql} | Error: ${err.message}`);
    throw err;
  }
}

async function testConnection() {
  try {
    const client = getPool();
    await client.query('SELECT 1');
    console.log('[DB] Supabase PostgreSQL connection established successfully.');
  } catch (err) {
    console.error('[DB] Supabase PostgreSQL connection failed:', err.message);
    throw err;
  }
}

module.exports = { query, getPool, testConnection };
