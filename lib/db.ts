import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data.sqlite')
const db = new Database(dbPath)

// Create tables if not exist
// measurements: id, station, time, las
// weather: id, station, time, windSpeed, windDir, relHumidity, created_at

db.exec(`
  CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station TEXT NOT NULL,
    time TEXT NOT NULL,
    las REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS weather (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station TEXT NOT NULL,
    time TEXT NOT NULL,
    windSpeed REAL,
    windDir TEXT,
    relHumidity REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

export function insertMeasurement(station: string, time: string, las: number) {
  const stmt = db.prepare(
    'INSERT INTO measurements (station, time, las) VALUES (?, ?, ?)' 
  )
  stmt.run(station, time, las)
}

export function insertWeather(
  station: string,
  time: string,
  windSpeed: number,
  windDir: string,
  relHumidity: number
) {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO weather (station, time, windSpeed, windDir, relHumidity, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
  )
  stmt.run(station, time, windSpeed, windDir, relHumidity)
}

export function getWeatherForBlock(station: string, time: string) {
  const stmt = db.prepare(
    'SELECT * FROM weather WHERE station = ? AND time = ? LIMIT 1'
  )
  return stmt.get(station, time) || null
}

export function isWeatherDataOld(station: string, time: string, maxAgeMinutes: number = 10): boolean {
  const stmt = db.prepare(
    'SELECT created_at FROM weather WHERE station = ? AND time = ? LIMIT 1'
  )
  const result = stmt.get(station, time) as { created_at: string } | undefined
  
  if (!result) return true // No data exists, so it's "old"
  
  const createdAt = new Date(result.created_at)
  const now = new Date()
  const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60)
  
  return diffMinutes > maxAgeMinutes
} 