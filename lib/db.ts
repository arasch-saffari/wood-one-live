import db from './database'
import path from 'path'
import fs from 'fs'
import Papa from 'papaparse'
import { processCSVFile, processAllCSVFiles } from './csv-processing'
import { addWeatherCron } from './weather'
import { addInitialWeather } from './weather'
import csvWatcher from './csv-watcher'
import cron from 'node-cron'

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

// Robust migration system
function runMigrations() {
  // Migration 1: Add created_at column to weather table
  try {
    // Check if created_at column exists
    const columns = db.prepare("PRAGMA table_info(weather)").all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>
    const hasCreatedAt = columns.some(col => col.name === 'created_at')
    
    if (!hasCreatedAt) {
      console.log('🔄 Running migration: Adding created_at column to weather table...')
      
      // Start transaction for safe migration
      db.exec('BEGIN TRANSACTION')
      
      try {
        // Add the new column
        db.exec('ALTER TABLE weather ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP')
        
        // Update existing records with current timestamp
        const updateCount = db.prepare(
          'UPDATE weather SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL'
        ).run()
        
        console.log(`✅ Migration completed: ${updateCount.changes} existing records updated`)
        db.exec('COMMIT')
        
      } catch (migrationError) {
        console.error('❌ Migration failed:', migrationError)
        db.exec('ROLLBACK')
        throw migrationError
      }
    } else {
      console.log('✅ created_at column already exists, skipping migration')
    }
  } catch (e) {
    console.error('❌ Migration check failed:', e)
    // Don't throw - allow app to continue with existing schema
  }
  
  // Migration 2: Add source_file column to measurements table
  try {
    const columns = db.prepare("PRAGMA table_info(measurements)").all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>
    const hasSourceFile = columns.some(col => col.name === 'source_file')
    
    if (!hasSourceFile) {
      console.log('🔄 Running migration: Adding source_file column to measurements table...')
      
      // Start transaction for safe migration
      db.exec('BEGIN TRANSACTION')
      
      try {
        // Add the new column
        db.exec('ALTER TABLE measurements ADD COLUMN source_file TEXT')
        console.log('✅ source_file column added successfully')
        db.exec('COMMIT')
        
      } catch (migrationError) {
        console.error('❌ Migration failed:', migrationError)
        db.exec('ROLLBACK')
        throw migrationError
      }
    } else {
      console.log('✅ source_file column already exists, skipping migration')
    }
  } catch (e) {
    console.error('❌ Migration check failed:', e)
    // Don't throw - allow app to continue with existing schema
  }
  
  // Migration 3: Add temperature column to weather table
  try {
    const columns = db.prepare("PRAGMA table_info(weather)").all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>
    const hasTemperature = columns.some(col => col.name === 'temperature')
    
    if (!hasTemperature) {
      console.log('🔄 Running migration: Adding temperature column to weather table...')
      
      // Start transaction for safe migration
      db.exec('BEGIN TRANSACTION')
      
      try {
        // Add the new column
        db.exec('ALTER TABLE weather ADD COLUMN temperature REAL')
        
        console.log('✅ Migration completed: temperature column added to weather table')
        db.exec('COMMIT')
        
      } catch (migrationError) {
        console.error('❌ Migration failed:', migrationError)
        db.exec('ROLLBACK')
        throw migrationError
      }
    } else {
      console.log('✅ temperature column already exists, skipping migration')
    }
  } catch (e) {
    console.error('❌ Migration check failed:', e)
    // Don't throw - allow app to continue with existing schema
  }

  // Migration 4: Add datetime column to measurements table (robust, ohne NOT NULL)
  try {
    const columns = db.prepare("PRAGMA table_info(measurements)").all() as Array<{ name: string }>
    const hasDatetime = columns.some(col => col.name === 'datetime')
    if (!hasDatetime) {
      console.log('🔄 Running migration: Adding datetime column to measurements table...')
      db.exec('BEGIN TRANSACTION')
      try {
        db.exec('ALTER TABLE measurements ADD COLUMN datetime DATETIME') // ohne NOT NULL
        // Fülle bestehende Einträge mit aktuellem Datum + time
        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
        db.prepare('UPDATE measurements SET datetime = ? || \' \' || time WHERE datetime IS NULL').run(today)
        console.log('✅ datetime column added and filled')
        db.exec('COMMIT')
      } catch (migrationError) {
        console.error('❌ Migration failed:', migrationError)
        db.exec('ROLLBACK')
        throw migrationError
      }
    } else {
      console.log('✅ datetime column already exists, skipping migration')
    }
  } catch (e) {
    console.error('❌ Migration check failed:', e)
  }
}

// Run migrations on startup
runMigrations()

// Integritäts-Check nach Migrationen
try {
  const nulls = db.prepare('SELECT COUNT(*) as count FROM measurements WHERE station IS NULL OR time IS NULL OR las IS NULL').get() as { count: number }
  if (nulls.count > 0) {
    console.warn(`⚠️  Integritätsproblem: ${nulls.count} Messungen mit NULL in NOT NULL-Spalten gefunden!`)
  }
} catch (e) {
  console.error('❌ Integritäts-Check nach Migrationen fehlgeschlagen:', e)
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

export function getRecentWeather(station: string) {
  const stmt = db.prepare(
    'SELECT windSpeed, windDir, relHumidity, temperature FROM weather WHERE station = ? ORDER BY created_at DESC LIMIT 1'
  )
  const result = stmt.get(station) as { windSpeed: number; windDir: string; relHumidity: number; temperature: number | null } | undefined
  return result || null
}

// Utility function to check database health
export function checkDatabaseHealth() {
  try {
    const weatherCount = db.prepare('SELECT COUNT(*) as count FROM weather').get() as { count: number }
    const measurementsCount = db.prepare('SELECT COUNT(*) as count FROM measurements').get() as { count: number }
    
    console.log(`📊 Database health check:`)
    console.log(`   Weather records: ${weatherCount.count}`)
    console.log(`   Measurement records: ${measurementsCount.count}`)
    
    // Check for records with missing created_at (should be 0 after migration)
    const missingCreatedAt = db.prepare('SELECT COUNT(*) as count FROM weather WHERE created_at IS NULL').get() as { count: number }
    if (missingCreatedAt.count > 0) {
      console.warn(`⚠️  Found ${missingCreatedAt.count} weather records without created_at timestamp`)
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
addInitialWeather()

// CSVs beim Start immer importieren (auch im Build/Production)
if (typeof processAllCSVFiles === 'function') {
  processAllCSVFiles()
}

// Start CSV watcher for automatic processing
console.log('🚀 Starting automatic CSV processing...')
csvWatcher.start()
addWeatherCron() 

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
      console.log(`[Backup] Datenbank-Backup erstellt: ${backupPath}`)
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
      const fs = require('fs')
      const path = require('path')
      const file = path.join(process.cwd(), 'backups', 'last-health-problem.json')
      fs.writeFileSync(file, JSON.stringify(health, null, 2))
      console.warn('[HealthCheck] Integritätsproblem erkannt und notify-Flag gesetzt:', health)
    }
  } catch (e) {
    console.error('[HealthCheck] Fehler beim automatischen Health-Check:', e)
  }
})

// Monitoring für wiederkehrende Fehler (täglich)
cron.schedule('30 3 * * *', () => {
  try {
    const fs = require('fs')
    const path = require('path')
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
      console.warn('[Monitoring] Wiederkehrende Fehler erkannt und notify-Flag gesetzt:', health)
    }
  } catch (e) {
    console.error('[Monitoring] Fehler bei der Fehleranalyse:', e)
  }
})

export { db, processAllCSVFiles } 