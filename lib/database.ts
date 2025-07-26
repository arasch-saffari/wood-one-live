import Database from 'better-sqlite3'
import path from 'path'
// Import with fallbacks for missing dependencies
let logQueryPerformance: any = () => {};
let logger: any = console;
let DatabaseError: any = Error;
let TimeUtils: any = null;

try {
  const loggerModule = require('./logger');
  logQueryPerformance = loggerModule.logQueryPerformance || (() => {});
  logger = loggerModule.logger || console;
  DatabaseError = loggerModule.DatabaseError || Error;
} catch (error) {
  console.warn('Logger module not available, using console');
}

try {
  const timeModule = require('./time-utils');
  TimeUtils = timeModule.TimeUtils;
} catch (error) {
  console.warn('Time utils not available');
}

// Use environment variable directly to avoid circular dependency
const dbPath = process.env.DB_PATH || './data.sqlite'

interface ProfiledDatabase extends Database.Database {
  profiledQuery: (sql: string, params?: unknown, thresholdMs?: number) => unknown
}

// Initialize database with proper error handling
let db: ProfiledDatabase;

try {
  db = new Database(dbPath) as ProfiledDatabase;
  logger.info({ dbPath }, 'Database connection established');
  
  // Performance-Pragmas für SQLite
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('cache_size = 50000'); // ca. 50MB
    db.pragma('temp_store = MEMORY');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000'); // 5 second timeout for database locked errors
    
    logger.info('SQLite performance pragmas applied successfully');
  } catch (pragmaError) {
    logger.warn({ error: pragmaError }, 'Could not set SQLite pragmas');
  }

  // Erstelle measurements_15min_agg Tabelle
  db.exec(`
    CREATE TABLE IF NOT EXISTS measurements_15min_agg (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station TEXT NOT NULL,
      bucket TEXT NOT NULL,
      avgLas REAL NOT NULL,
      UNIQUE(station, bucket)
    )
  `)

  // Erstelle measurements_hourly_agg Tabelle
  db.exec(`
    CREATE TABLE IF NOT EXISTS measurements_hourly_agg (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station TEXT NOT NULL,
      bucket TEXT NOT NULL,
      avgLas REAL NOT NULL,
      UNIQUE(station, bucket)
    )
  `)
} catch (error) {
  logger.fatal({ error, dbPath }, 'Failed to initialize database connection');
  throw new DatabaseError('Database initialization failed', { dbPath, error });
}

db.profiledQuery = function(sql: string, params?: unknown, thresholdMs: number = 200) {
  const start = Date.now()
  const stmt = db.prepare(sql)
  const result = params ? stmt.all(params) : stmt.all()
  const duration = Date.now() - start
  logQueryPerformance(sql, duration, thresholdMs)
  return result
}

// Database connection cleanup
let isShuttingDown = false

export function closeDatabase() {
  if (isShuttingDown) return
  isShuttingDown = true
  
  try {
    logger.info('Closing SQLite database connection...');
    db.close();
    logger.info('Database connection closed successfully');
  } catch (error) {
    logger.error({ error }, 'Error closing database connection');
  }
}

// Singleton-Pattern für Cleanup-Handler
declare global {
  var dbCleanupRegistered: boolean | undefined
}

if (typeof process !== 'undefined' && process.on && !global.dbCleanupRegistered) {
  global.dbCleanupRegistered = true
  
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received, closing database...');
    closeDatabase()
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('beforeExit', () => {
    logger.info('Process exiting, closing database...');
    closeDatabase()
  })
}

// Database health check function
export function checkDatabaseHealth(): { healthy: boolean; error?: string } {
  try {
    const result = db.prepare('SELECT 1 as test').get() as { test: number };
    return { healthy: result.test === 1 };
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return { healthy: false, error: (error as Error).message };
  }
}

// Enhanced database operations with error handling
export class DatabaseService {
  static executeQuery<T>(sql: string, params?: unknown[]): T[] {
    try {
      const start = Date.now();
      const stmt = db.prepare(sql);
      const result = params ? stmt.all(...params) : stmt.all();
      const duration = Date.now() - start;
      
      logQueryPerformance(sql, duration);
      return result as T[];
    } catch (error) {
      logger.error({ error, sql, params }, 'Database query failed');
      throw new DatabaseError('Query execution failed', { sql, params, error });
    }
  }

  static executeQuerySingle<T>(sql: string, params?: unknown[]): T | undefined {
    try {
      const start = Date.now();
      const stmt = db.prepare(sql);
      const result = params ? stmt.get(...params) : stmt.get();
      const duration = Date.now() - start;
      
      logQueryPerformance(sql, duration);
      return result as T | undefined;
    } catch (error) {
      logger.error({ error, sql, params }, 'Database query failed');
      throw new DatabaseError('Query execution failed', { sql, params, error });
    }
  }

  static executeTransaction<T>(operations: () => T): T {
    const transaction = db.transaction(operations);
    try {
      return transaction();
    } catch (error) {
      logger.error({ error }, 'Database transaction failed');
      throw new DatabaseError('Transaction failed', { error });
    }
  }
}

export default db 