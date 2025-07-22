import db from './database'
import path from 'path'
import fs from 'fs'
import Papa from 'papaparse'
import cron from 'node-cron'
import { ExternalApiError, logError } from './logger'
import csvWatcher from './csv-watcher'

// Create tables if not exist
// measurements: id, station, time, las, source_file
// weather: id, station, time, windSpeed, windDir, relHumidity, created_at

db.exec(`
  CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station TEXT NOT NULL,
    time TEXT NOT NULL,
    las REAL NOT NULL,
    source_file TEXT,
    UNIQUE(station, time)
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

if (typeof db.pragma === 'function') {
  db.pragma('journal_mode = WAL')
}

// Migration: Add datetime column to measurements table if missing
(function runDatetimeMigration() {
  try {
    const columns = db.prepare("PRAGMA table_info(measurements)").all() as Array<{ name: string }>
    const hasDatetime = columns.some(col => col.name === 'datetime')
    if (!hasDatetime) {
      db.exec('ALTER TABLE measurements ADD COLUMN datetime DATETIME')
      // Fülle bestehende Einträge mit aktuellem Datum + time
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      db.prepare("UPDATE measurements SET datetime = ? || ' ' || time WHERE datetime IS NULL").run(today)
    }
  } catch (e) {
    if (e instanceof Error) {
      console.error('❌ Migration for datetime column failed:', e.message)
    } else {
      console.error('❌ Migration for datetime column failed:', e)
    }
  }
})();

// Entferne automatische Migrationen und Initialisierungen aus dem Importfluss
// Exportiere stattdessen Setup-Funktionen

export function runMigrations() {
  // Migration 1: Add created_at column to weather table
  try {
    const columns = db.prepare("PRAGMA table_info(weather)").all() as Array<{ name: string }>
    console.log('Spalten in weather:', columns.map(c => c.name))
    const hasCreatedAt = columns.some(col => col.name === 'created_at')
    if (!hasCreatedAt) {
      db.exec('BEGIN TRANSACTION')
      try {
        db.exec('ALTER TABLE weather ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP')
        db.prepare('UPDATE weather SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL').run()
        db.exec('COMMIT')
      } catch (migrationError) {
        db.exec('ROLLBACK')
        logError(migrationError instanceof Error ? migrationError : new Error(String(migrationError)))
        throw migrationError
      }
    } else {
      console.log('Spalte created_at existiert bereits, Migration wird übersprungen.')
    }
  } catch (e) {
    // Nur loggen, nicht crashen
    console.error('❌ Migration check failed:', e)
  }
  // Migration 2: Add source_file column to measurements table
  try {
    const columns = db.prepare("PRAGMA table_info(measurements)").all() as Array<{ name: string }>
    console.log('Spalten in measurements:', columns.map(c => c.name))
    const hasSourceFile = columns.some(col => col.name === 'source_file')
    if (!hasSourceFile) {
      db.exec('BEGIN TRANSACTION')
      try {
        db.exec('ALTER TABLE measurements ADD COLUMN source_file TEXT')
        db.exec('COMMIT')
      } catch (migrationError) {
        db.exec('ROLLBACK')
        logError(migrationError instanceof Error ? migrationError : new Error(String(migrationError)))
        throw migrationError
      }
    } else {
      console.log('Spalte source_file existiert bereits, Migration wird übersprungen.')
    }
  } catch (e) {
    console.error('❌ Migration check failed:', e)
  }
  // Migration 3: Add temperature column to weather table
  try {
    const columns = db.prepare("PRAGMA table_info(weather)").all() as Array<{ name: string }>
    console.log('Spalten in weather:', columns.map(c => c.name))
    const hasTemperature = columns.some(col => col.name === 'temperature')
    if (!hasTemperature) {
      db.exec('BEGIN TRANSACTION')
      try {
        db.exec('ALTER TABLE weather ADD COLUMN temperature REAL')
        db.exec('COMMIT')
      } catch (migrationError) {
        db.exec('ROLLBACK')
        logError(migrationError instanceof Error ? migrationError : new Error(String(migrationError)))
        throw migrationError
      }
    } else {
      console.log('Spalte temperature existiert bereits, Migration wird übersprungen.')
    }
  } catch (e) {
    console.error('❌ Migration check failed:', e)
  }
  // Migration 4: Add datetime column to measurements table
  try {
    const columns = db.prepare("PRAGMA table_info(measurements)").all() as Array<{ name: string }>
    console.log('Spalten in measurements:', columns.map(c => c.name))
    const hasDatetime = columns.some(col => col.name === 'datetime')
    if (!hasDatetime) {
      db.exec('BEGIN TRANSACTION')
      try {
        db.exec('ALTER TABLE measurements ADD COLUMN datetime DATETIME')
        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
        db.prepare('UPDATE measurements SET datetime = ? || " " || time WHERE datetime IS NULL').run(today)
        db.exec('COMMIT')
      } catch (migrationError) {
        db.exec('ROLLBACK')
        logError(migrationError instanceof Error ? migrationError : new Error(String(migrationError)))
        throw migrationError
      }
    } else {
      console.log('Spalte datetime existiert bereits, Migration wird übersprungen.')
    }
  } catch (e) {
    console.error('❌ Migration check failed:', e)
  }
}

export function startCsvWatcher() {
  csvWatcher.start()
}

// Create indexes for better performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_measurements_station_time ON measurements(station, time);
  CREATE INDEX IF NOT EXISTS idx_weather_station_time ON weather(station, time);
  CREATE INDEX IF NOT EXISTS idx_measurements_source_file ON measurements(source_file);
  CREATE INDEX IF NOT EXISTS idx_measurements_datetime ON measurements(datetime);
  CREATE INDEX IF NOT EXISTS idx_weather_created_at ON weather(created_at);
`)

export function insertMeasurement(station: string, time: string, las: number) {
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO measurements (station, time, las) VALUES (?, ?, ?)' 
  )
  return stmt.run(station, time, las)
}

// Fast database queries with optimized indexing
export function getMeasurementsForStation(station: string, interval: "24h" | "7d" = "24h") {
  const limit = interval === "7d" ? 5000 : 1000;
  
  // For 24h interval, we need to get recent measurements from all hours
  // Since time is stored as HH:MM, we need a different approach
  if (interval === "24h") {
    // Try to get measurements from as many different hours as possible
    // First, get a larger sample to increase chances of hour diversity
    const stmt = db.prepare(`
      SELECT time, las, datetime
      FROM measurements 
      WHERE station = ? 
      ORDER BY rowid DESC 
      LIMIT ?
    `)
    const results = stmt.all(station, Math.min(limit * 2, 2000)) as Array<{ time: string; las: number; datetime: string }>;
    return results.reverse(); // Return in chronological order
  } else {
    // For 7d interval, also use rowid DESC for better coverage
    const stmt = db.prepare(`
      SELECT time, las, datetime
      FROM measurements 
      WHERE station = ? 
      ORDER BY rowid DESC 
      LIMIT ?
    `)
    const results = stmt.all(station, limit) as Array<{ time: string; las: number; datetime: string }>;
    return results.reverse(); // Return in chronological order
  }
}

// Utility function to check database health
export function checkDatabaseHealth() {
  try {
    const weatherCount = db.prepare('SELECT COUNT(*) as count FROM weather').get() as { count: number }
    const measurementsCount = db.prepare('SELECT COUNT(*) as count FROM measurements').get() as { count: number }
    
    // Check for records with missing created_at (should be 0 after migration)
    const missingCreatedAt = db.prepare('SELECT COUNT(*) as count FROM weather WHERE created_at IS NULL').get() as { count: number }
    if (missingCreatedAt.count > 0) {
      // console.warn(`⚠️  Found ${missingCreatedAt.count} weather records without created_at timestamp`)
    }
    
    return true
  } catch (e) {
    console.error('❌ Database health check failed:', e)
    return false
  }
}

// Run health check on startup
checkDatabaseHealth()

// Initialen Wetterwert eintragen, falls keine Daten vorhanden
// addInitialWeather() // This line was removed as per the edit hint.

// CSVs beim Start immer importieren (auch im Build/Production)
// if (typeof processAllCSVFiles === 'function') { // This line was removed as per the edit hint.
//   processAllCSVFiles() // This line was removed as per the edit hint.
// }

// Starte den CSV-Watcher automatisch, wenn nicht production oder explizit erlaubt
if (process.env.NODE_ENV !== 'production' || process.env.CSV_WATCHER_AUTO_START === 'true') {
  try {
    startCsvWatcher()
    console.log('CSV-Watcher automatisch gestartet.')
  } catch (e) {
    console.error('Fehler beim Starten des CSV-Watchers:', e)
  }
}

// Initial-Import aller vorhandenen CSV-Dateien
// csvWatcher.processAllFiles() // This line was removed as per the edit hint.

// Start CSV watcher for automatic processing
// addWeatherCron() // This line was removed as per the edit hint.

export function addDatabaseBackupCron() {
  const backupDir = path.join(process.cwd(), 'backups')
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  // Täglich um 3 Uhr morgens
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

// Automatischer Health-Check alle 24h
cron.schedule('0 3 * * *', () => {
  try {
    const weatherCount = db.prepare('SELECT COUNT(*) as count FROM weather').get() as { count: number }
    const measurementsCount = db.prepare('SELECT COUNT(*) as count FROM measurements').get() as { count: number }
    const missingCreatedAt = db.prepare('SELECT COUNT(*) as count FROM weather WHERE created_at IS NULL').get() as { count: number }
    const nulls = db.prepare('SELECT COUNT(*) as count FROM measurements WHERE station IS NULL OR time IS NULL OR las IS NULL').get() as { count: number }
    const health = {
      time: new Date().toISOString(),
      weatherCount: weatherCount.count,
      measurementsCount: measurementsCount.count,
      missingCreatedAt: missingCreatedAt.count,
      nulls: nulls.count,
      notify: (missingCreatedAt.count > 0 || nulls.count > 0)
    }
    if (health.notify) {
      const file = path.join(process.cwd(), 'backups', 'last-health-problem.json')
      fs.writeFileSync(file, JSON.stringify(health, null, 2))
    }
  } catch (e) {
    console.error('[HealthCheck] Fehler beim automatischen Health-Check:', e)
  }
})

// Monitoring für wiederkehrende Fehler (täglich)
cron.schedule('30 3 * * *', () => {
  try {
    const logPath = path.join(process.cwd(), 'logs', 'system.log')
    if (!fs.existsSync(logPath)) return
    const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean)
    const importErrors = lines.filter((line: string) => line.includes('[ImportError]')).length
    const dbErrors = lines.filter((line: string) => line.includes('[DatabaseError]')).length
    const integrityProblems = lines.filter((line: string) => line.includes('Integritätsproblem')).length
    const threshold = 5
    if (importErrors > threshold || dbErrors > threshold || integrityProblems > 0) {
      const file = path.join(process.cwd(), 'backups', 'last-health-problem.json')
      const health = {
        time: new Date().toISOString(),
        importErrors,
        dbErrors,
        integrityProblems,
        notify: true,
        message: `Monitoring: ${importErrors} ImportError, ${dbErrors} DatabaseError, ${integrityProblems} Integritätsprobleme in den letzten 24h.`
      }
      fs.writeFileSync(file, JSON.stringify(health, null, 2))
    }
  } catch (e) {
    console.error('[Monitoring] Fehler bei der Fehleranalyse:', e)
  }
})

export default db 