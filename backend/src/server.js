require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./config/database');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await testConnection();
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
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    console.error('[Server] Ensure Supabase PostgreSQL is running and .env is configured correctly.');
    process.exit(1);
  }
}

startServer();
