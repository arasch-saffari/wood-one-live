// This file is for server-side weather fetching only
// Client-side weather fetching is handled via API endpoints

import db from './database'

export async function fetchWeather() {
  const maxRetries = 3;
  const timeoutMs = 5000; // 5 second timeout
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=50.414&longitude=6.387&current=temperature_2m,relativehumidity_2m,windspeed_10m,winddirection_10m&timezone=Europe%2FBerlin';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      // Open-Meteo liefert aktuelle Werte unter data.current
      const current = data.current || {};
      return {
        windSpeed: typeof current.windspeed_10m === 'number' ? current.windspeed_10m : null,
        windDir: typeof current.winddirection_10m === 'number' ? `${current.winddirection_10m}\u00b0` : null,
        relHumidity: typeof current.relativehumidity_2m === 'number' ? current.relativehumidity_2m : null,
        temperature: current.temperature_2m !== undefined ? Math.round(current.temperature_2m) : null,
      };
    } catch (error) {
      console.warn(`Weather fetch attempt ${attempt}/${maxRetries} failed:`, error instanceof Error ? error.message : 'Unknown error', 'Details:', error);
      if (attempt === maxRetries) {
        throw new Error(`Failed to fetch weather after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error('Unexpected end of function');
}

export async function addInitialWeather() {
  // Prüfe, ob Wetterdaten vorhanden sind
  const row = db.prepare('SELECT COUNT(*) as count FROM weather').get() as { count: number }
  if (row.count === 0) {
    // Füge einen initialen Wetterwert für jetzt ein
    const now = new Date()
    const time = now.toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM
    let windSpeed = 10
    let windDir = 180
    let relHumidity = 50
    let temperature = 20
    try {
      const live = await fetchWeather()
      if (typeof live.windSpeed === 'number') windSpeed = live.windSpeed
      if (typeof live.windDir === 'string') windDir = parseFloat(live.windDir)
      else if (typeof live.windDir === 'number') windDir = live.windDir
      if (typeof live.relHumidity === 'number') relHumidity = live.relHumidity
      if (typeof live.temperature === 'number') temperature = live.temperature
    } catch (e) {
      console.warn('⚠️ Konnte keine Live-Wetterdaten für Initialeintrag abrufen, nutze Dummy-Werte.')
    }
    db.prepare('INSERT OR IGNORE INTO weather (station, time, windSpeed, windDir, relHumidity, temperature, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
      .run('global', time, windSpeed, windDir, relHumidity, temperature)
    console.log('🌦️ Initialer Wetterwert eingetragen:', { time, windSpeed, windDir, relHumidity, temperature })
  }
}

// Wetterdaten alle 10 Minuten automatisch abrufen und speichern (nur im Server-Umfeld)
export function addWeatherCron() {
  if (typeof process === 'undefined' || process.env.NODE_ENV === 'test') return
  console.log('[Wetter-Cron] Initialisiert. Alle 10 Minuten wird ein Wetter-Update versucht.')
  setInterval(async () => {
    try {
      const now = new Date()
      const berlin = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
      const min = berlin.getMinutes()
      const blockMin = Math.floor(min / 5) * 5
      const blockTime = berlin.getHours().toString().padStart(2, '0') + ':' + blockMin.toString().padStart(2, '0')
      console.log(`[Wetter-Cron] UTC: ${now.toISOString()}, Berlin: ${berlin.toISOString()}, blockTime: ${blockTime}`)
      const weather = await fetchWeather()
      console.log('[Wetter-Cron] API-Werte:', weather)
      // Station 'global', Zeit = aktuelle 5min-Block
      const { windSpeed, windDir, relHumidity, temperature } = weather
      const stmt = db.prepare('INSERT OR REPLACE INTO weather (station, time, windSpeed, windDir, relHumidity, temperature, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
      const result = stmt.run('global', blockTime, windSpeed ?? 0, windDir ?? '', relHumidity ?? 0, temperature ?? null)
      console.log('[Wetter-Cron] Wetterdaten gespeichert:', { blockTime, windSpeed, windDir, relHumidity, temperature, result })
    } catch (e) {
      console.error('[Wetter-Cron] Fehler beim Abrufen/Speichern:', e)
    }
  }, 10 * 60 * 1000) // alle 10 Minuten
} 