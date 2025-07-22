import { NextResponse } from "next/server";
import { getMeasurementsForStation } from "@/lib/db";
import { getWeatherForBlock, insertWeather, isWeatherDataOld } from "@/lib/db-helpers";
import { fetchWeather } from "@/lib/weather";
import Papa from "papaparse";
import fs from "fs";
import path from "path";
import { getThresholdsForStationAndTime, checkRateLimit } from '@/lib/utils'

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
  // --- Rate Limiting ---
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || ''
  if (!checkRateLimit(ip, '/api/station-data', 200, 60_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte einen Moment.' }, { status: 429 })
  }
  const { searchParams } = new URL(req.url)
  const station = searchParams.get("station")
  const interval = (searchParams.get("interval") as "24h" | "7d") || "24h"
  const granularity = searchParams.get("granularity") || "10min"
  const page = parseInt(searchParams.get("page") || "1", 10)
  const pageSize = parseInt(searchParams.get("pageSize") || "0", 10) // 0 = alles
  const cacheKey = `${station}-${interval}-${granularity}-${page}-${pageSize}`
  const CACHE_DURATION = getCacheDuration()
  // Cache-Check
  const cached = apiCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return new Response(JSON.stringify(cached.data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const { searchParams } = new URL(req.url);
    const station = searchParams.get("station");
    const interval = (searchParams.get("interval") as "24h" | "7d") || "24h";
    const granularity = searchParams.get("granularity") || "10min";
    
    if (!station) {
      return NextResponse.json({ error: "Missing station parameter" }, { status: 400 });
    }
    
    // Konfiguration laden
    const config = getConfig();
    const calculationMode = config.calculationMode || 'average';
    const lasThreshold = config.lasThreshold ?? 50;
    const lafThreshold = config.lafThreshold ?? 52;
    const warningThreshold = config.warningThreshold ?? 55;
    const alarmThreshold = config.alarmThreshold ?? 60;

    // Dynamische Chart-Limits je nach Zeitraum und Granularität
    // Ziel: Übersichtlichkeit + ausreichend Detailtiefe
    let chartLimit = 50; // Fallback
    
    if (interval === "24h") {
      if (granularity === "1min") chartLimit = 1440; // 24h vollständig (1440 min = 24h)
      else if (granularity === "5min") chartLimit = 288; // 24h vollständig (288 × 5min = 24h)
      else if (granularity === "10min") chartLimit = 144; // 24h vollständig (144 × 10min = 24h)
      else if (granularity === "1h") chartLimit = 24; // 24h vollständig (24 × 1h = 24h)
    } else if (interval === "7d") {
      if (granularity === "1min") chartLimit = 2016; // 7d × 288 (5min-Intervalle für bessere Übersicht)
      else if (granularity === "5min") chartLimit = 2016; // 7d × 288 (5min-Intervalle)
      else if (granularity === "10min") chartLimit = 1008; // 7d × 144 (10min-Intervalle)
      else if (granularity === "1h") chartLimit = 168; // 7d vollständig (168 × 1h = 7d)
    }

    const measurements = getMeasurementsForStation(station, interval);
    
    // In aggregateByBlock: Sammle zu jedem Block auch das zugehörige späteste datetime
    function aggregateByBlock(measurements: { time: string; las: number; datetime?: string }[], blockMinutes: number) {
      if (measurements.length === 0) {
        return [];
      }
      const blocks: Record<string, { las: number[]; datetimes: string[] }> = {};
      for (const m of measurements) {
        const timeParts = m.time.split(":");
        if (timeParts.length < 2) continue;
        const h = timeParts[0];
        const mStr = timeParts[1];
        const min = parseInt(mStr, 10);
        const blockMin = Math.floor(min / blockMinutes) * blockMinutes;
        const blockTime = `${h.padStart(2, "0")}:${blockMin.toString().padStart(2, "0")}`;
        if (!blocks[blockTime]) blocks[blockTime] = { las: [], datetimes: [] };
        blocks[blockTime].las.push(m.las);
        if (m.datetime) blocks[blockTime].datetimes.push(m.datetime);
      }
      const result = Object.entries(blocks)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([time, { las, datetimes }]) => {
          let lasValue = 0;
          if (calculationMode === 'max') {
            lasValue = Math.max(...las);
          } else if (calculationMode === 'median') {
            const sorted = [...las].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            lasValue = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
          } else {
            lasValue = las.reduce((a, b) => a + b, 0) / las.length;
          }
          // Wähle das späteste datetime für diesen Block
          const datetime = datetimes.length > 0 ? datetimes.sort().reverse()[0] : undefined;
          return {
            time,
            las: Number(lasValue.toFixed(2)),
            datetime,
          };
        });
      return result;
    }
    
    let blockMinutes = 10;
    if (granularity === "5min") blockMinutes = 5;
    if (granularity === "1min") blockMinutes = 1;
    if (granularity === "1h") blockMinutes = 60;
    
    let aggregated = aggregateByBlock(measurements, blockMinutes);
    
    // Begrenze auf das dynamische Limit VOR Wetteranreicherung
    const limitedAggregated = aggregated.slice(-chartLimit);
    // Pagination anwenden (optional)
    let pagedAggregated = limitedAggregated
    const totalCount = limitedAggregated.length
    if (pageSize > 0) {
      const start = (page - 1) * pageSize
      pagedAggregated = limitedAggregated.slice(start, start + pageSize)
    }
    let result: Array<{
      time: string;
      las: number;
      ws: number | null;
      wd: string | null;
      rh: number | null;
      temp: number | null;
      lasThreshold: number;
      lafThreshold: number;
      warningThreshold: number;
      alarmThreshold: number;
      datetime?: string | undefined;
    }> = [];
    if (pagedAggregated.length === 0) {
      result = [];
    } else {
      const weatherBlocks = pagedAggregated.map(m => roundTo5MinBlock(m.time));
      const uniqueWeatherBlocks = Array.from(new Set(weatherBlocks));
      const weatherPromises = uniqueWeatherBlocks.map(async (time) => {
        const weather = await getWeatherWithCache(station, time);
        return { time, weather };
      });
      const weatherResults = await Promise.all(weatherPromises);
      const weatherMap: Record<string, { windSpeed: number; windDir: string; relHumidity: number }> = Object.fromEntries(
        weatherResults.map(({ time, weather }) => [time, weather])
      );
      result = pagedAggregated.map(measurement => {
        const w = weatherMap[roundTo5MinBlock(measurement.time)];
        const weather = (w && typeof w.windSpeed === 'number' && typeof w.windDir === 'string' && typeof w.relHumidity === 'number')
          ? { windSpeed: w.windSpeed, windDir: w.windDir, relHumidity: w.relHumidity, temperature: (w as any).temperature ?? null }
          : { windSpeed: null, windDir: null, relHumidity: null, temperature: null };
        // Dynamische Schwellenwerte bestimmen
        const thresholds = getThresholdsForStationAndTime(config, station, measurement.time)
        return {
          time: measurement.time,
          las: measurement.las,
          datetime: measurement.datetime,
          ws: weather.windSpeed,
          wd: weather.windDir,
          rh: weather.relHumidity,
          temp: weather.temperature,
          lasThreshold: thresholds.las,
          lafThreshold: thresholds.laf,
          warningThreshold: thresholds.warning,
          alarmThreshold: thresholds.alarm,
        };
      });
    }
    apiCache.set(cacheKey, { data: { data: result, totalCount }, timestamp: Date.now() })
    return new Response(JSON.stringify({ data: result, totalCount }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('Error in station-data API:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
} 