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
  console.warn('Warnung: Konnte SQLite-Pragmas nicht setzen:', e)
}

db.profiledQuery = function(sql: string, params?: unknown, thresholdMs: number = 200) {
  const start = Date.now()
  const stmt = db.prepare(sql)
  const result = params ? stmt.all(params) : stmt.all()
  const duration = Date.now() - start
  logQueryPerformance(sql, duration, thresholdMs)
  return result
}

export default db 