import db from './database'
import path from 'path'
import fs from 'fs'

// Import with fallbacks for missing dependencies
let cron: any = null;
let logError: any = console.error;
let csvWatcher: any = null;
let fetchWeather: any = null;

try {
  cron = require('node-cron');
} catch (error) {
  console.warn('node-cron not available, cron functionality disabled');
  cron = {
    schedule: () => ({ stop: () => {} })
  };
}

try {
  const loggerModule = require('./logger');
  logError = loggerModule.logError || console.error;
} catch (error) {
  console.warn('Logger module not available');
}

try {
  csvWatcher = require('./csv-watcher').default;
} catch (error) {
  console.warn('CSV watcher not available');
  csvWatcher = {
    start: () => {},
    processAllFiles: () => {}
  };
}

try {
  const weatherModule = require('./weather');
  fetchWeather = weatherModule.fetchWeather;
} catch (error) {
  console.warn('Weather module not available');
  fetchWeather = async () => ({
    windSpeed: 0,
    windDir: '',
    relHumidity: 0,
    temperature: null
  });
}

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
    datetime DATETIME,
    all_csv_fields TEXT, -- JSON field for all CSV data
    UNIQUE(station, datetime)
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
  CREATE TABLE IF NOT EXISTS thresholds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station TEXT NOT NULL,
    from_time TEXT NOT NULL,
    to_time TEXT NOT NULL,
    warning REAL NOT NULL,
    alarm REAL NOT NULL,
    las REAL,
    laf REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(station, from_time, to_time)
  );
  CREATE TABLE IF NOT EXISTS thresholds_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threshold_id INTEGER,
    station TEXT NOT NULL,
    from_time TEXT NOT NULL,
    to_time TEXT NOT NULL,
    old_warning REAL,
    new_warning REAL,
    old_alarm REAL,
    new_alarm REAL,
    old_las REAL,
    new_las REAL,
    old_laf REAL,
    new_laf REAL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    action TEXT NOT NULL CHECK(action IN ('insert','update','delete'))
  );
  CREATE TABLE IF NOT EXISTS csv_raw_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station TEXT NOT NULL,
    time TEXT NOT NULL,
    datetime DATETIME,
    source_file TEXT,
    csv_row_data TEXT, -- Complete JSON of CSV row
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(station, time, source_file)
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
      try {
        db.exec('ALTER TABLE measurements ADD COLUMN datetime DATETIME')
        // Fülle bestehende Einträge mit aktuellem Datum + time
        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
        db.prepare("UPDATE measurements SET datetime = ? || ' ' || time WHERE datetime IS NULL").run(today)
      } catch (e: unknown) {
        const error = e as Error
        if (error.message && error.message.includes('duplicate column name')) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Spalte datetime existiert bereits, Migration wird übersprungen.')
          }
        } else {
          throw e
        }
      }
    }
  } catch (e) {
    if (e instanceof Error) {
      console.error('❌ Migration for datetime column failed:', e.message)
    } else {
      console.error('❌ Migration for datetime column failed:', e)
    }
  }
})();

// Migration: Passe UNIQUE-Constraint auf (station, datetime) an
(function migrateUniqueConstraint() {
  try {
    // Prüfe, ob alter UNIQUE-Constraint existiert
    const pragma = db.prepare("PRAGMA index_list('measurements')").all() as Array<{ name: string, unique: number }>
    const uniqueIdx = pragma.find(idx => idx.unique && idx.name.includes('station') && idx.name.includes('time'))
    if (uniqueIdx) {
      // SQLite erlaubt kein direktes Entfernen von Constraints, daher: Tabelle umbenennen, neu anlegen, Daten kopieren
      db.exec('BEGIN TRANSACTION')
      db.exec('ALTER TABLE measurements RENAME TO measurements_old')
      db.exec(`CREATE TABLE measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        station TEXT NOT NULL,
        time TEXT NOT NULL,
        las REAL NOT NULL,
        source_file TEXT,
        datetime DATETIME,
        all_csv_fields TEXT,
        UNIQUE(station, datetime)
      )`)
      db.exec('INSERT INTO measurements (id, station, time, las, source_file, datetime, all_csv_fields) SELECT id, station, time, las, source_file, datetime, all_csv_fields FROM measurements_old')
      db.exec('DROP TABLE measurements_old')
      db.exec('COMMIT')
      if (process.env.NODE_ENV === 'development') {
        console.log('UNIQUE-Constraint auf (station, datetime) migriert.')
      }
    }
  } catch (e) {
    console.error('Fehler bei Migration UNIQUE-Constraint:', e)
    db.exec('ROLLBACK')
  }
})() // <- Semikolon ergänzt

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
  // Migration 5: Add all_csv_fields column to measurements table
  try {
    const columns = db.prepare("PRAGMA table_info(measurements)").all() as Array<{ name: string }>
    console.log('Spalten in measurements:', columns.map(c => c.name))
    const hasAllCsvFields = columns.some(col => col.name === 'all_csv_fields')
    if (!hasAllCsvFields) {
      db.exec('BEGIN TRANSACTION')
      try {
        db.exec('ALTER TABLE measurements ADD COLUMN all_csv_fields TEXT')
        db.exec('COMMIT')
      } catch (migrationError) {
        db.exec('ROLLBACK')
        logError(migrationError instanceof Error ? migrationError : new Error(String(migrationError)))
        throw migrationError
      }
    } else {
      console.log('Spalte all_csv_fields existiert bereits, Migration wird übersprungen.')
    }
  } catch (e) {
    console.error('❌ Migration check failed:', e)
  }
  // Migration 6: Add alarm_threshold column to thresholds table if missing
  try {
    const columns = db.prepare("PRAGMA table_info(thresholds)").all() as Array<{ name: string }>
    const hasAlarmThreshold = columns.some(col => col.name === 'alarm_threshold')
    if (!hasAlarmThreshold) {
      try {
        // Add alarm_threshold column and populate it with the existing alarm values
        db.exec('ALTER TABLE thresholds ADD COLUMN alarm_threshold REAL')
        db.prepare("UPDATE thresholds SET alarm_threshold = alarm WHERE alarm_threshold IS NULL").run()
        console.log('✅ Added alarm_threshold column to thresholds table')
      } catch (e: unknown) {
        const error = e as Error
        if (error.message && error.message.includes('duplicate column name')) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Spalte alarm_threshold existiert bereits, Migration wird übersprungen.')
          }
        } else {
          throw e
        }
      }
    }
    
    // Create default threshold records if none exist
    const thresholdCount = db.prepare("SELECT COUNT(*) as count FROM thresholds").get() as { count: number }
    if (thresholdCount.count === 0) {
      const stations = ['ort', 'techno', 'heuballern', 'band']
      for (const station of stations) {
        db.prepare(`
          INSERT INTO thresholds (station, from_time, to_time, warning, alarm, alarm_threshold, las, laf)
          VALUES (?, '00:00', '23:59', 50, 60, 60, 60, 60)
        `).run(station)
      }
      console.log('✅ Created default threshold records for all stations')
    }
  } catch (e) {
    if (e instanceof Error) {
      console.error('❌ Migration for alarm_threshold column failed:', e.message)
    } else {
      console.error('❌ Migration for alarm_threshold column failed:', e)
    }
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

  -- Materialisierte 15min-Aggregation
  CREATE TABLE IF NOT EXISTS measurements_15min_agg (
    station TEXT NOT NULL,
    bucket DATETIME NOT NULL,
    avgLas REAL NOT NULL,
    PRIMARY KEY (station, bucket)
  );
`)

// Aktualisiert die 15min-Aggregate für die letzten 7 Tage
export function update15MinAggregates() {
  db.exec(`
    INSERT OR REPLACE INTO measurements_15min_agg (station, bucket, avgLas)
    SELECT station,
           strftime('%Y-%m-%d %H:%M:00', datetime, '-' || (CAST(strftime('%M', datetime) AS INTEGER) % 15) || ' minutes') as bucket,
           AVG(las) as avgLas
    FROM measurements
    WHERE datetime >= datetime('now', '-7 days')
    GROUP BY station, bucket;
  `)
}

export function insertMeasurement(station: string, time: string, las: number) {
  // time und datetime identisch setzen
  const datetime = time
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO measurements (station, time, las, datetime) VALUES (?, ?, ?, ?)' 
  )
  return stmt.run(station, time, las, datetime)
}

// Fast database queries with optimized indexing - with SQL-level pagination
export function getMeasurementsForStation(
  station: string, 
  options: {
    page?: number
    pageSize?: number
    sortBy?: 'time' | 'las' | 'datetime'
    sortOrder?: 'asc' | 'desc'
    timeFilter?: '24h' | '7d' | 'all'
  } = {}
) {
  const { page = 1, pageSize = 10000, sortBy = 'datetime', sortOrder = 'desc', timeFilter = 'all' } = options
  
  // Validierung der Parameter
  const validSortFields = ['time', 'las', 'datetime']
  const validSortOrders = ['asc', 'desc']
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'datetime'
  const safeSortOrder = validSortOrders.includes(sortOrder) ? sortOrder.toUpperCase() : 'DESC'
  
  // Zeitfilter bestimmen
  let timeCondition = ''
  if (timeFilter === '24h') {
    timeCondition = "AND m.datetime >= datetime('now', '-24 hours')"
  } else if (timeFilter === '7d') {
    timeCondition = "AND m.datetime >= datetime('now', '-7 days')"
  }
  
  // Berechne LIMIT und OFFSET
  const limit = Math.min(Math.max(1, pageSize), 10000) // Max 10k Zeilen pro Seite
  const offset = Math.max(0, (page - 1) * limit)
  
  // Hauptquery mit Pagination und Zeitfilter
  const stmt = db.prepare(`
    SELECT m.time, m.las, m.datetime,
      w.windSpeed as ws, w.windDir as wd, w.relHumidity as rh, w.temperature as temp
    FROM measurements m
    LEFT JOIN weather w
      ON w.station = 'global'
      AND w.time = (
        substr(m.time,1,3) || printf('%02d', (CAST(substr(m.time,4,2) AS INTEGER) / 10) * 10) || ':00'
      )
    WHERE m.station = ? ${timeCondition}
    ORDER BY m.${safeSortBy} ${safeSortOrder}
    LIMIT ? OFFSET ?
  `)
  
  // Count-Query für totalCount mit Zeitfilter
  const countStmt = db.prepare(`
    SELECT COUNT(*) as total
    FROM measurements
    WHERE station = ? ${timeCondition}
  `)
  
  const results = stmt.all(station, limit, offset) as Array<{ 
    time: string; 
    las: number; 
    datetime: string; 
    ws?: number; 
    wd?: string; 
    rh?: number; 
    temp?: number 
  }>
  
  const countResult = countStmt.get(station) as { total: number }
  const totalCount = countResult.total
  
  return {
    data: results,
    totalCount,
    page,
    pageSize: limit,
    totalPages: Math.ceil(totalCount / limit)
  }
}

// Legacy function for backward compatibility
export function getMeasurementsForStationLegacy(station: string) {
  const result = getMeasurementsForStation(station, { pageSize: 10000 })
  return result.data.reverse() // Chronologische Reihenfolge wie vorher
}

// Liefert minütliche Mittelwerte für eine Station und einen Zeitraum
export function getMinuteAveragesForStation(station: string, interval: "24h" | "7d" = "24h") {
  // Zeitraum bestimmen
  let since = ''
  if (interval === "24h") {
    since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
  } else if (interval === "7d") {
    since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
  }
  const stmt = db.prepare(`
    SELECT strftime('%Y-%m-%d %H:%M:00', datetime) as bucket, AVG(las) as avgLas
    FROM measurements
    WHERE station = ? AND datetime >= ?
    GROUP BY bucket
    ORDER BY bucket ASC
  `)
  return stmt.all(station, since) as Array<{ bucket: string, avgLas: number }>
}

export function get15MinAveragesForStation(station: string, interval: "24h" | "7d" = "24h") {
  // Zeitraum bestimmen
  let since = ''
  if (interval === "24h") {
    since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
  } else if (interval === "7d") {
    since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
  }
  // Lies direkt aus der materialisierten Tabelle
  const stmt = db.prepare(`
    SELECT bucket, avgLas
    FROM measurements_15min_agg
    WHERE station = ? AND bucket >= ?
    ORDER BY bucket ASC
  `)
  return stmt.all(station, since) as Array<{ bucket: string, avgLas: number }>
}

// Utility function to check database health
export function checkDatabaseHealth() {
  try {
    const missingCreatedAt = db.prepare('SELECT COUNT(*) as count FROM weather WHERE created_at IS NULL').get() as { count: number }
    
    // Check for records with missing created_at (should be 0 after migration)
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

// Starte CSV-Watcher und Wetter-Cronjob nur, wenn explizit erlaubt
if (process.env.ENABLE_BACKGROUND_JOBS === 'true') {
  try {
    startCsvWatcher()
    console.log('CSV-Watcher automatisch gestartet.')
  } catch (e) {
    console.error('Fehler beim Starten des CSV-Watchers:', e)
  }

  // Automatischer Wetter-Update-Cronjob (alle 10 Minuten) - mit Timeout-Schutz
  cron.schedule('*/10 * * * *', async () => {
    const startTime = Date.now()
    const TIMEOUT_MS = 30000 // 30 Sekunden Timeout
    
    try {
      // Promise mit Timeout für bessere Kontrolle
      const weatherPromise = Promise.race([
        (async () => {
          const now = new Date()
          const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
          const weather = await fetchWeather()
          
          const result = db.prepare('INSERT OR REPLACE INTO weather (station, time, windSpeed, windDir, relHumidity, temperature, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
            .run('global', time, weather.windSpeed ?? 0, weather.windDir ?? '', weather.relHumidity ?? 0, weather.temperature ?? null)
          
          return { weather, result }
        })(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Weather update timeout')), TIMEOUT_MS)
        )
      ])
      
      const { weather, result } = await weatherPromise as { weather: { windSpeed: number, windDir: string, relHumidity: number, temperature: number | null }, result: { changes: number } }
      
      const duration = Date.now() - startTime
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Wetter-Cron] Wetterdaten aktualisiert in ${duration}ms:`, weather, 'Insert result:', result)
      }
      
      // Warnung bei langsamen Updates
      if (duration > 10000) {
        console.warn(`[Wetter-Cron] Langsamer Wetter-Update: ${duration}ms`)
      }
      
    } catch (e) {
      const duration = Date.now() - startTime
      console.error(`[Wetter-Cron] Fehler beim Wetter-Update nach ${duration}ms:`, e)
    }
  })
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
  // Täglich um 3 Uhr morgens - ASYNC für non-blocking I/O mit Timeout-Schutz
  cron.schedule('0 3 * * *', async () => {
    const startTime = Date.now()
    const TIMEOUT_MS = 60000 // 60 Sekunden Timeout für Backup
    
    try {
      const backupPromise = Promise.race([
        (async () => {
          const dbPath = path.join(process.cwd(), 'data.sqlite')
          if (!fs.existsSync(dbPath)) return null
          
          const now = new Date()
          const name = `backup-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}.sqlite`
          const backupPath = path.join(backupDir, name)
          
          // Non-blocking async copy
          await fs.promises.copyFile(dbPath, backupPath)
          return name
        })(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Backup timeout')), TIMEOUT_MS)
        )
      ])
      
      const backupName = await backupPromise
      const duration = Date.now() - startTime
      
      if (backupName && process.env.NODE_ENV === 'development') {
        console.log(`[Backup] Backup erstellt in ${duration}ms: ${backupName}`)
      }
      
      // Warnung bei langsamen Backups
      if (duration > 30000) {
        console.warn(`[Backup] Langsames Backup: ${duration}ms`)
      }
      
    } catch (e) {
      const duration = Date.now() - startTime
      console.error(`[Backup] Fehler beim Erstellen des Backups nach ${duration}ms:`, e)
    }
  })
}

addDatabaseBackupCron() 

// Automatischer Health-Check alle 24h - ASYNC für non-blocking I/O mit Timeout-Schutz
cron.schedule('0 3 * * *', async () => {
  const startTime = Date.now()
  const TIMEOUT_MS = 30000 // 30 Sekunden Timeout
  
  try {
    const healthPromise = Promise.race([
      (async () => {
        const missingCreatedAt = db.prepare('SELECT COUNT(*) as count FROM weather WHERE created_at IS NULL').get() as { count: number }
        const nulls = db.prepare('SELECT COUNT(*) as count FROM measurements WHERE station IS NULL OR time IS NULL OR las IS NULL').get() as { count: number }
        const health = {
          time: new Date().toISOString(),
          missingCreatedAt: missingCreatedAt.count,
          nulls: nulls.count,
          notify: (missingCreatedAt.count > 0 || nulls.count > 0)
        }
        if (health.notify) {
          const file = path.join(process.cwd(), 'backups', 'last-health-problem.json')
          // Non-blocking async write
          await fs.promises.writeFile(file, JSON.stringify(health, null, 2))
        }
        return health
      })(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), TIMEOUT_MS)
      )
    ])
    
    const health = await healthPromise as { notify: boolean }
    const duration = Date.now() - startTime
    
    if (health.notify && process.env.NODE_ENV === 'development') {
      console.log(`[HealthCheck] Health-Problem-Datei erstellt in ${duration}ms`)
    }
    
    // Warnung bei langsamen Health-Checks
    if (duration > 15000) {
      console.warn(`[HealthCheck] Langsamer Health-Check: ${duration}ms`)
    }
    
  } catch (e) {
    const duration = Date.now() - startTime
    console.error(`[HealthCheck] Fehler beim automatischen Health-Check nach ${duration}ms:`, e)
  }
})

// Monitoring für wiederkehrende Fehler (täglich) - ASYNC für non-blocking I/O mit Timeout-Schutz
cron.schedule('30 3 * * *', async () => {
  const startTime = Date.now()
  const TIMEOUT_MS = 45000 // 45 Sekunden Timeout für Log-Analyse
  
  try {
    const monitoringPromise = Promise.race([
      (async () => {
        const logPath = path.join(process.cwd(), 'logs', 'system.log')
        
        // Non-blocking async file existence check
        try {
          await fs.promises.access(logPath)
        } catch {
          return null // File doesn't exist
        }
        
        // Non-blocking async file read
        const logContent = await fs.promises.readFile(logPath, 'utf-8')
        const lines = logContent.split('\n').filter(Boolean)
        
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
          
          // Non-blocking async write
          await fs.promises.writeFile(file, JSON.stringify(health, null, 2))
          return health
        }
        return null
      })(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Monitoring timeout')), TIMEOUT_MS)
      )
    ])
    
    const result = await monitoringPromise
    const duration = Date.now() - startTime
    
    if (result && process.env.NODE_ENV === 'development') {
      console.log(`[Monitoring] Health-Problem-Datei für Monitoring erstellt in ${duration}ms`)
    }
    
    // Warnung bei langsamer Log-Analyse
    if (duration > 20000) {
      console.warn(`[Monitoring] Langsame Log-Analyse: ${duration}ms`)
    }
    
  } catch (e) {
    const duration = Date.now() - startTime
    console.error(`[Monitoring] Fehler bei der Fehleranalyse nach ${duration}ms:`, e)
  }
})

// Cronjob: Aktualisiere alle 5 Minuten die 15min-Aggregate
// cron.schedule('*/5 * * * *', () => { // This line was removed as per the edit hint.
//   try {
//     update15MinAggregates()
//     console.log('[15min-Aggregate] Tabelle aktualisiert')
//   } catch (e) {
//     console.error('[15min-Aggregate] Fehler bei Aktualisierung:', e)
//   }
// })

export default db 

// Manual database initialization to ensure tables are created
console.log('🔧 Initializing database tables...')
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station TEXT NOT NULL,
      time TEXT NOT NULL,
      las REAL NOT NULL,
      source_file TEXT,
      datetime DATETIME,
      all_csv_fields TEXT,
      UNIQUE(station, datetime)
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
    CREATE TABLE IF NOT EXISTS thresholds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station TEXT NOT NULL,
      from_time TEXT NOT NULL,
      to_time TEXT NOT NULL,
      warning REAL NOT NULL,
      alarm REAL NOT NULL,
      alarm_threshold REAL,
      las REAL,
      laf REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(station, from_time, to_time)
    );
    CREATE TABLE IF NOT EXISTS measurements_15min_agg (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station TEXT NOT NULL,
      bucket DATETIME NOT NULL,
      avgLas REAL NOT NULL,
      UNIQUE(station, bucket)
    );
  `)
  console.log('✅ Database tables initialized successfully')
} catch (error) {
  console.error('❌ Database initialization failed:', error)
} 