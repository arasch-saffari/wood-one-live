import { NextResponse } from "next/server";
import { getMeasurementsForStation } from "@/lib/db";
import { getWeatherForBlock, insertWeather, isWeatherDataOld } from "@/lib/db-helpers";
import { fetchWeather } from "@/lib/weather";
import Papa from "papaparse";
import fs from "fs";
import path from "path";
import { getThresholdsForStationAndTime, checkRateLimit } from '@/lib/utils'
import db from '@/lib/database'
import os from 'os'
import { getMinuteAveragesForStation } from '@/lib/db'

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

// Server-seitiges Caching für große Zeiträume
const stationDataCache = new Map<string, { data: any, timestamp: number }>()
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 Minuten

// File-Cache für große Zeiträume
const CACHE_DIR = path.join(process.cwd(), 'cache')
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
}
const FILE_CACHE_DURATION_MS = 5 * 60 * 1000 // 5 Minuten

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
  const station = searchParams.get("station")
  const page = parseInt(searchParams.get("page") || "1", 10)
  const pageSize = parseInt(searchParams.get("pageSize") || "1000", 10)
  const aggregate = searchParams.get("aggregate")
  const interval = (searchParams.get("interval") as "24h" | "7d") || "24h"
  if (!station) {
    return NextResponse.json({ error: "Missing station parameter" }, { status: 400 });
  }
  // Aggregation: minütliche Mittelwerte
  if (aggregate === "minutely") {
    const minuteAverages = getMinuteAveragesForStation(station, interval)
    const totalCount = minuteAverages.length
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paged = minuteAverages.slice(start, end)
    console.log(`[API station-data] Station: ${station}, Aggregation: minutely, Count: ${totalCount}`)
    return NextResponse.json({ data: paged, totalCount, page, pageSize })
  }
  // File-Cache-Logik wieder aktivieren
  const cacheFile = path.join(CACHE_DIR, `stationdata-${station}.json`)
  let allData: { data: any[], totalCount: number } | null = null
  let usedCache = false
  if (fs.existsSync(cacheFile)) {
    const stats = fs.statSync(cacheFile)
    if (Date.now() - stats.mtimeMs < FILE_CACHE_DURATION_MS) {
      allData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))
      usedCache = true
    }
  }
  if (!allData) {
    const measurements = getMeasurementsForStation(station);
    const result = measurements.map(m => ({
      time: m.time,
      las: m.las,
      datetime: m.datetime,
      ws: m.ws,
      wd: m.wd,
      rh: m.rh,
    }));
    allData = { data: result, totalCount: result.length }
    if (result.length > 5000) {
      fs.writeFileSync(cacheFile, JSON.stringify(allData))
    }
  }
  if (!allData) {
    console.log(`[API station-data] Station: ${station}, Rohdaten: 0, usedCache: ${usedCache}`)
    return NextResponse.json({ data: [], totalCount: 0, page, pageSize })
  }
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const pagedData = allData.data.slice(start, end)
  console.log(`[API station-data] Station: ${station}, Rohdaten: ${allData.totalCount}, usedCache: ${usedCache}`)
  return NextResponse.json({ data: pagedData, totalCount: allData.totalCount, page, pageSize });
} 