require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./config/database');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await testConnection();
  } catch (err) {
    console.error('[DB Warning] Supabase PostgreSQL connection check failed on startup:', err.message);
    console.error('[DB Warning] Server will start and retry connecting during incoming requests.');
  }

  app.listen(PORT, () => {
    console.log('');
    console.log('  ╔═══════════════════════════════════════════════╗');
    console.log('  ║   Smart Face Biometric Attendance System       ║');
    console.log('  ║   Backend API Server                           ║');
    console.log('  ╚═══════════════════════════════════════════════╝');
    console.log(`  Server running on: http://localhost:${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Health check: http://localhost:${PORT}/api/health`);
    console.log('');
  });
}

startServer();
