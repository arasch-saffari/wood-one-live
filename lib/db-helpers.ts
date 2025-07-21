import db from './database'

export function insertWeather(
  station: string,
  time: string,
  windSpeed: number,
  windDir: string,
  relHumidity: number,
  temperature?: number
) {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO weather (station, time, windSpeed, windDir, relHumidity, temperature, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
  )
  stmt.run(station, time, windSpeed, windDir, relHumidity, temperature ?? null)
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