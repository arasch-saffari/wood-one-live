export class ValidationError extends Error {
  constructor(message: string, public context?: any) {
    super(message)
    this.name = 'ValidationError'
  }
}
export class DatabaseError extends Error {
  constructor(message: string, public context?: any) {
    super(message)
    this.name = 'DatabaseError'
  }
}
export class ImportError extends Error {
  constructor(message: string, public context?: any) {
    super(message)
    this.name = 'ImportError'
  }
}
export class ExternalApiError extends Error {
  constructor(message: string, public context?: any) {
    super(message)
    this.name = 'ExternalApiError'
  }
}

export function logError(error: Error) {
  const fs = require('fs')
  const path = require('path')
  const logPath = path.join(process.cwd(), 'logs', 'system.log')
  // Type Guard für context
  const hasContext = (err: any): err is { context: any } => 'context' in err && err.context !== undefined
  const entry = `[${new Date().toISOString()}] [${error.name}] ${error.message}${hasContext(error) ? ' | ' + JSON.stringify(error.context) : ''}\n`
  fs.appendFileSync(logPath, entry)
  console.error(entry)
} 