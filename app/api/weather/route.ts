import { NextResponse } from "next/server"
import { fetchWeather } from "@/lib/weather"
import { getWeatherForBlock, insertWeather, isWeatherDataOld } from "@/lib/db-helpers"
import { roundTo5MinBlock } from "@/lib/utils"
import db from '@/lib/database'

// Hilfsfunktion für Einzel- oder Batchabfrage
interface WeatherDB {
  windSpeed?: number;
  windDir?: string | number;
  relHumidity?: number;
  temperature?: number | null;
}
export async function getOrFetchWeather(station: string, time: string) {
  const blockTime = roundTo5MinBlock(time)
  let weather = getWeatherForBlock(station, blockTime) as WeatherDB | null
  
  // Check if weather data is older than 10 minutes or doesn't exist
  if (!weather || isWeatherDataOld(station, blockTime, 10)) {
    try {
      const live = await fetchWeather()
      insertWeather(
        station,
        blockTime,
        live.windSpeed ?? 0,
        live.windDir ?? "N/A",
        live.relHumidity ?? 0,
        typeof live.temperature === 'number' ? live.temperature : undefined
      )
      weather = getWeatherForBlock(station, blockTime) as WeatherDB | null
    } catch (e) {
      // If fetch fails, return existing data if available
      if (!weather) {
        return { windSpeed: null, windDir: null, relHumidity: null, temperature: null, noWeatherData: true };
      }
    }
  }
  // Rückgabeobjekt immer mit allen Feldern, mit Type Guard
  if (!weather || typeof weather !== 'object') {
    return { windSpeed: null, windDir: null, relHumidity: null, temperature: null, noWeatherData: true };
  }
  let windDirValue = null;
  if (typeof weather.windDir === 'string' && weather.windDir.endsWith('°')) {
    windDirValue = parseFloat(weather.windDir);
  } else if (typeof weather.windDir === 'number') {
    windDirValue = weather.windDir;
  } else if (typeof weather.windDir === 'string') {
    windDirValue = weather.windDir;
  }
  return {
    windSpeed: typeof weather.windSpeed === 'number' ? weather.windSpeed : 0,
    windDir: windDirValue,
    relHumidity: typeof weather.relHumidity === 'number' ? weather.relHumidity : 0,
    temperature: typeof weather.temperature === 'number' ? weather.temperature : null
  }
}

export async function GET(req: Request) {
  const { pathname } = new URL(req.url)
  if (pathname.endsWith('/last-update')) {
    // Spezialroute für letztes Wetter-Update
    try {
      const stmt = db.prepare('SELECT created_at FROM weather ORDER BY created_at DESC LIMIT 1')
      const row = stmt.get() as { created_at?: string } | undefined
      if (!row || !row.created_at) {
        return NextResponse.json({ time: null, ago: null, iso: null })
      }
      const createdAt = new Date(row.created_at)
      const now = new Date()
      const diffMin = Math.floor((now.getTime() - createdAt.getTime()) / 60000)
      let ago = 'gerade eben'
      if (diffMin === 1) ago = 'vor 1 Min'
      else if (diffMin > 1) ago = `vor ${diffMin} Min`
      return NextResponse.json({ time: createdAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), ago, iso: row.created_at })
    } catch (e) {
      return NextResponse.json({ time: null, ago: null, iso: null })
    }
  }
  try {
    const { searchParams } = new URL(req.url)
    const station = searchParams.get("station") || "global"
    const time = searchParams.get("time")
    if (!time) {
      return NextResponse.json({ error: "Missing time parameter" }, { status: 400 })
    }
    let weather: any
    if (time === 'now') {
      // Gib den letzten Wetterwert mit echten Daten zurück
      const row = db.prepare(`
        SELECT * FROM weather
        WHERE station = ?
          AND windSpeed IS NOT NULL
          AND relHumidity IS NOT NULL
          AND temperature IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      `).get(station) as any
      weather = row || null
    } else {
      weather = await getOrFetchWeather(station, time)
    }
    // Rückgabeobjekt immer mit allen Feldern (wie in getOrFetchWeather)
    if (!weather || typeof weather !== 'object') {
      return NextResponse.json({ windSpeed: 0, windDir: null, relHumidity: 0, temperature: null })
    }
    let windDirValue = null;
    if (typeof weather.windDir === 'string' && weather.windDir.endsWith('°')) {
      windDirValue = parseFloat(weather.windDir);
    } else if (typeof weather.windDir === 'number') {
      windDirValue = weather.windDir;
    } else if (typeof weather.windDir === 'string') {
      windDirValue = weather.windDir;
    }
    return NextResponse.json({
      windSpeed: typeof weather.windSpeed === 'number' ? weather.windSpeed : 0,
      windDir: windDirValue,
      relHumidity: typeof weather.relHumidity === 'number' ? weather.relHumidity : 0,
      temperature: typeof weather.temperature === 'number' ? weather.temperature : null
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
} 