import { NextResponse } from "next/server";
import { getMeasurementsForStation } from "@/lib/db";
import { getWeatherForBlock, insertWeather, isWeatherDataOld } from "@/lib/db-helpers";
import { fetchWeather } from "@/lib/weather";
import Papa from "papaparse";
import fs from "fs";
import path from "path";
import { getThresholdsForStationAndTime, checkRateLimit } from '@/lib/utils'
import db from '@/lib/database'

const configPath = path.join(process.cwd(), 'config.json')
function getConfig() {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function getCacheDuration() {
  try {
    const configPath = path.join(process.cwd(), 'config.json')
    if (!fs.existsSync(configPath)) return 60 * 1000
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return typeof config.apiCacheDuration === 'number' ? config.apiCacheDuration * 1000 : 60 * 1000
  } catch { return 60 * 1000 }
}

// Weather cache for performance
const weatherCache = new Map<string, { data: any; timestamp: number }>();

const apiCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 60 * 1000 // 1 Minute

function roundTo5MinBlock(time: string): string {
  const [h, m] = time.split(":");
  if (!h || !m) return time;
  const min = parseInt(m, 10);
  const blockMin = Math.floor(min / 5) * 5;
  return `${h.padStart(2, "0")}:${blockMin.toString().padStart(2, "0")}`;
}

async function getWeatherWithCache(station: string, time: string) {
  // Check cache first
  const cacheKey = `${station}-${time}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // Try to fetch from database if time is provided
  if (time) {
    try {
      const weatherData = await getWeatherForBlock(station, time);
      if (weatherData) {
        weatherCache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
        return weatherData;
      }
    } catch (error) {
      // console.warn(`Failed to fetch weather from database for ${station} at ${time}:`, error);
    }
  }

  // Try live fetch
  try {
    const liveData = await fetchWeather();
    // Save to database if we have station and time context
    if (station && time) {
      await insertWeather(station, time, liveData.windSpeed || 0, liveData.windDir || '', liveData.relHumidity || 0, liveData.temperature || 15);
    }
    weatherCache.set(cacheKey, { data: liveData, timestamp: Date.now() });
    return liveData;
  } catch (error) {
    // console.warn(`Weather service unavailable, using fallback data:`, error);
    
    // Try to get the most recent weather data from database
    try {
      // const recentWeather = await getRecentWeather(station); // This line is removed
      // if (recentWeather) { // This line is removed
      //   console.log(`Using recent weather data from database for ${station}`); // This line is removed
      //   weatherCache.set(cacheKey, { data: recentWeather, timestamp: Date.now() }); // This line is removed
      //   return recentWeather; // This line is removed
      // } // This line is removed
    } catch (dbError) {
      // console.warn(`Failed to fetch recent weather from database for ${station}:`, dbError);
    }

    // Ultimate fallback to reasonable defaults
    return { windSpeed: null, windDir: null, relHumidity: null, temperature: null, noWeatherData: true };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const test = searchParams.get('test')
  if (test === '1') {
    // Test-Endpunkt: Gib rohe Messdaten für die Station zurück
    const station = searchParams.get('station')
    if (!station) return NextResponse.json({ error: 'Missing station parameter' }, { status: 400 })
    try {
      const rows = db.prepare('SELECT * FROM measurements WHERE station = ? ORDER BY datetime ASC LIMIT 500').all(station)
      return NextResponse.json({ data: rows, totalCount: rows.length })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Fehler beim Test-Query' }, { status: 500 })
    }
  }
  // --- Rate Limiting ---
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || ''
  if (!checkRateLimit(ip, '/api/station-data', 200, 60_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte einen Moment.' }, { status: 429 })
  }
  const station = searchParams.get("station")
  if (!station) {
    return NextResponse.json({ error: "Missing station parameter" }, { status: 400 });
  }
  // Konfiguration laden
  const config = getConfig();
  // Hole die letzten 1000 (24h) oder 5000 (7d) Messwerte für die Station
  const interval = (searchParams.get("interval") as "24h" | "7d") || "24h";
  const measurements = getMeasurementsForStation(station, interval);
  // Hole Wetterdaten für die Zeitpunkte (optional, falls benötigt)
  // ... Wetterdaten-Logik kann optional bleiben ...
  // Baue das Ergebnis-Array
  const result = measurements.map(m => ({
    time: m.time,
    las: m.las,
    datetime: m.datetime,
    ws: m.ws,
    wd: m.wd,
    rh: m.rh,
  }));
  return NextResponse.json({ data: result, totalCount: result.length });
} 