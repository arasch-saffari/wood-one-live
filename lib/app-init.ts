import { setupGlobalErrorHandlers } from './middleware/error-handler';
import { logger } from './logger';
import { config } from './config';
import { checkDatabaseHealth } from './database';

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