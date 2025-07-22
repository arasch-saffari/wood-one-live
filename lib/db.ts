import db from './database'
import path from 'path'
import fs from 'fs'
import cron from 'node-cron'
import { logError } from './logger'

// Create tables if not exist
// measurements: station, date, time, maxSPLAFast
// weather: id, station, time, windSpeed, windDir, relHumidity, temperature, created_at

db.exec(`
  CREATE TABLE IF NOT EXISTS measurements (
    station TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    maxSPLAFast REAL NOT NULL,
    UNIQUE(station, date, time)
  );
  CREATE TABLE IF NOT EXISTS weather (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station TEXT NOT NULL,
    time TEXT NOT NULL,
    windSpeed REAL,
    windDir TEXT,
    relHumidity REAL,
    temperature REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(station, time)
  );
`)

// Insert-Logik für Messwerte
export function insertMeasurement(station: string, date: string, time: string, maxSPLAFast: number) {
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO measurements (station, date, time, maxSPLAFast) VALUES (?, ?, ?, ?)' 
  )
  return stmt.run(station, date, time, maxSPLAFast)
}

// Query für Messwerte
export function getMeasurementsForStation(station: string) {
  const stmt = db.prepare(`
    SELECT station, date, time, maxSPLAFast
    FROM measurements 
    WHERE station = ? 
    ORDER BY date ASC, time ASC
  `)
  return stmt.all(station)
}

// Utility function to check database health
export function checkDatabaseHealth() {
  try {
    const weatherCount = db.prepare('SELECT COUNT(*) as count FROM weather').get() as { count: number }
    const measurementsCount = db.prepare('SELECT COUNT(*) as count FROM measurements').get() as { count: number }
    return true
  } catch (e) {
    console.error('❌ Database health check failed:', e)
    return false
  }
}

checkDatabaseHealth()

// Backup-Cronjob für die Datenbank
export function addDatabaseBackupCron() {
  const backupDir = path.join(process.cwd(), 'backups')
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  cron.schedule('0 3 * * *', () => {
    try {
      const dbPath = path.join(process.cwd(), 'data.sqlite')
      if (!fs.existsSync(dbPath)) return
      const now = new Date()
      const name = `backup-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}.sqlite`
      const backupPath = path.join(backupDir, name)
      fs.copyFileSync(dbPath, backupPath)
    } catch (e) {
      console.error('[Backup] Fehler beim Erstellen des Backups:', e)
    }
  })
}

addDatabaseBackupCron()

export default db 