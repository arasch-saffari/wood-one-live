import fs from 'fs'
import path from 'path'

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
  const logFilePath = path.join(process.cwd(), 'logs', 'system.log')
  const logDir = path.dirname(logFilePath)
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
  const logEntry = `[${new Date().toISOString()}] ${error.name}: ${error.message}\n${error.stack || ''}\n\n`
  fs.appendFileSync(logFilePath, logEntry)
} 