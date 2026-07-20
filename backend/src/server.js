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

  const server = app.listen(PORT, () => {
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

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[Server Error] Port ${PORT} is already in use.`);
      console.error(`[Server Error] Another instance of the backend is already running.`);
      console.error(`[Server Fix]   Run this command to kill it:  Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`);
      console.error(`[Server Fix]   Or use:  netstat -ano | findstr :${PORT}  then  taskkill /F /PID <PID>`);
      process.exit(1);
    } else {
      throw err;
    }
  });
}

startServer();
