import fs from 'fs'
import path from 'path'
import pino from 'pino'

// Configure pino logger with environment-based settings
// Disable pino-pretty completely to avoid worker thread issues in Next.js
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

export class ValidationError extends Error {
  constructor(message: string, public context?: unknown) {
    super(message)
    this.name = 'ValidationError'
  }
}
export class DatabaseError extends Error {
  constructor(message: string, public context?: unknown) {
    super(message)
    this.name = 'DatabaseError'
  }
}
export class ImportError extends Error {
  constructor(message: string, public context?: unknown) {
    super(message)
    this.name = 'ImportError'
  }
}
export class ExternalApiError extends Error {
  constructor(message: string, public context?: unknown) {
    super(message)
    this.name = 'ExternalApiError'
  }
}

export function logError(error: Error) {
  // Use pino for structured logging
  logger.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context: (error as any).context
    }
  }, 'Application error occurred');

  // Keep file logging for backwards compatibility
  const logFilePath = path.join(process.cwd(), 'logs', 'system.log')
  const logDir = path.dirname(logFilePath)
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
  const logEntry = `[${new Date().toISOString()}] ${error.name}: ${error.message}\n${error.stack || ''}\n\n`
  fs.appendFileSync(logFilePath, logEntry)
}

export function logQueryPerformance(query: string, durationMs: number, thresholdMs: number = 200) {
  if (durationMs < thresholdMs) return;
  
  // Use pino for structured logging
  logger.warn({
    query: {
      sql: query,
      duration: durationMs,
      threshold: thresholdMs
    }
  }, 'Slow query detected');

  // Keep file logging for backwards compatibility
  const logFilePath = path.join(process.cwd(), 'logs', 'slow-queries.log')
  const logDir = path.dirname(logFilePath)
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
  const logEntry = `[${new Date().toISOString()}] ${durationMs}ms\n${query}\n\n`
  fs.appendFileSync(logFilePath, logEntry)
} 