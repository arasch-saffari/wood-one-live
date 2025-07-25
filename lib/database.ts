import Database from 'better-sqlite3'
import path from 'path'
import { logQueryPerformance } from './logger'
const dbPath = path.join(process.cwd(), 'data.sqlite')

interface ProfiledDatabase extends Database.Database {
  profiledQuery: (sql: string, params?: unknown, thresholdMs?: number) => unknown
}

const db = new Database(dbPath) as ProfiledDatabase
// Performance-Pragmas für SQLite
try {
  db.pragma('journal_mode = WAL')
  db.pragma('cache_size = 50000') // ca. 50MB
  db.pragma('temp_store = MEMORY')
  db.pragma('synchronous = NORMAL')
} catch (e) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('Warnung: Konnte SQLite-Pragmas nicht setzen:', e)
  }
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
    if (process.env.NODE_ENV === 'development') {
      console.log('🔒 Schließe SQLite-Datenbankverbindung...')
    }
    db.close()
  } catch (error) {
    console.error('❌ Fehler beim Schließen der Datenbank:', error)
  }
}

// Singleton-Pattern für Cleanup-Handler
declare global {
  var dbCleanupRegistered: boolean | undefined
}

if (typeof process !== 'undefined' && process.on && !global.dbCleanupRegistered) {
  global.dbCleanupRegistered = true
  
  const shutdown = (signal: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📡 ${signal} empfangen, fahre System herunter...`)
    }
    closeDatabase()
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('beforeExit', () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Prozess beendet sich, schließe Datenbank...')
    }
    closeDatabase()
  })
}

export default db 