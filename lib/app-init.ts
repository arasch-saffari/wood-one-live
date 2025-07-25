import { setupGlobalErrorHandlers } from './middleware/error-handler';
import { logger } from './logger';
import { config } from './config';
import { checkDatabaseHealth } from './database';
import { runMigrations } from './db';
import fs from 'fs';
import path from 'path';

// Initialize application with proper error handling and logging
export function initializeApplication() {
  // Setup global error handlers
  setupGlobalErrorHandlers();

  // Log application startup
  logger.info({
    nodeEnv: config.server.nodeEnv,
    port: config.server.port,
    dbPath: config.database.path,
    logLevel: config.logging.level
  }, 'Application initializing...');

  // Clean up old logs on deployment
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    const systemLogPath = path.join(logsDir, 'system.log');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Clear the system log file to start fresh
    if (fs.existsSync(systemLogPath)) {
      fs.writeFileSync(systemLogPath, '');
      console.log('🧹 Cleared old logs for fresh deployment');
    }
    
    // Also clear any other log files in the logs directory
    const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
    for (const logFile of logFiles) {
      const logFilePath = path.join(logsDir, logFile);
      fs.writeFileSync(logFilePath, '');
    }
    
    console.log(`🧹 Cleared ${logFiles.length} log files for fresh deployment`);
  } catch (error) {
    console.warn('Could not clear logs:', error);
    // Don't fail initialization if log cleanup fails
  }

  // Run database migrations automatically
  try {
    logger.info('Running database migrations...');
    runMigrations();
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Database migration failed');
    // Don't exit on migration failure, just log the error
  }

  // Check database health on startup
  const dbHealth = checkDatabaseHealth();
  if (!dbHealth.healthy) {
    logger.fatal({ error: dbHealth.error }, 'Database health check failed during startup');
    process.exit(1);
  }

  logger.info('Application initialized successfully');
}

// Export for use in Next.js middleware or other entry points
export { config } from './config';
export { logger } from './logger';
export { checkDatabaseHealth } from './database';