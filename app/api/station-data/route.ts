import { NextResponse } from "next/server"
import { getMeasurementsForStation, getWeatherForBlock, insertWeather, isWeatherDataOld } from "@/lib/db"
import { fetchWeather } from "@/lib/weather"
import { roundTo5MinBlock } from "@/lib/utils"
import fs from "fs"
import path from "path"
import Papa from "papaparse"

// Simple in-memory cache for weather data
const weatherCache = new Map<string, { data: { windSpeed: number; windDir: string; relHumidity: number } | null; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Fallback function to parse CSV directly if no database data
function parseCSVFallback(station: string, interval: "24h" | "7d" = "24h") {
  try {
    const csvDir = path.join(process.cwd(), "public", "csv", station)
    if (!fs.existsSync(csvDir)) return []

    const files = fs.readdirSync(csvDir)
      .filter(file => file.endsWith('.csv') && !file.startsWith('_gsdata_'))
      .sort()
      .reverse() // Get latest files first

    if (files.length === 0) return []

    // Use the latest CSV file
    const latestFile = files[0]
    const csvPath = path.join(csvDir, latestFile)
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    
    const parsed = Papa.parse(csvContent, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
    })
    
    let rows = parsed.data as Record<string, string>[]
    if (!Array.isArray(rows) || rows.length < 2) return []
    
    rows = rows.slice(1) // drop first row
    
    // Determine the correct column name for noise level based on station
    const noiseColumn = station === "heuballern" ? "LAF" : "LAS"
    
    // Validate and process rows
    const validRows = rows.filter(
      (row) =>
        row["Systemzeit "] &&
        row[noiseColumn] &&
        !isNaN(Number(row[noiseColumn].replace(",", ".")))
    )
    
    // Aggregate into 15-min blocks
    const blocks: { [block: string]: number[] } = {}
    validRows.forEach((row) => {
      const sysTime = row["Systemzeit "]?.trim()
      const las = Number(row[noiseColumn].replace(",", "."))
      if (!sysTime || isNaN(las)) return
      
      // Parse time as HH:MM:SS:MS, use only HH:MM
      const [h, m] = sysTime.split(":")
      if (!h || !m) return
      const blockTime = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`
      if (!blocks[blockTime]) blocks[blockTime] = []
      blocks[blockTime].push(las)
    })
    
    // Convert to result format
    const result = Object.entries(blocks).map(([time, lasArr]) => {
      const las = Number((lasArr.reduce((a, b) => a + b, 0) / lasArr.length).toFixed(2))
      return {
        time,
        las,
        ws: 0, // Default values for weather
        wd: "N/A",
        rh: 0,
      }
    })
    
    // Limit based on interval
    const keepBlocks = interval === "7d" ? 672 : 96
    return result.slice(-keepBlocks)
  } catch (e) {
    console.error(`Error parsing CSV fallback for ${station}:`, e)
    return []
  }
}

// Optimized weather fetching with caching
async function getWeatherWithCache(station: string, time: string) {
  const cacheKey = `${station}-${time}`
  const now = Date.now()
  
  // Check cache first
  const cached = weatherCache.get(cacheKey)
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data
  }
  
  let weather = getWeatherForBlock(station, time)
  
  // Check if weather data is old or doesn't exist
  if (!weather || isWeatherDataOld(station, time, 10)) {
    try {
      const live = await fetchWeather()
      insertWeather(
        station,
        time,
        live.windSpeed ?? 0,
        live.windDir ?? "N/A",
        live.relHumidity ?? 0
      )
      weather = getWeatherForBlock(station, time)
    } catch (e) {
      console.error('Failed to fetch weather:', e)
      // If fetch fails, return existing data if available
      if (!weather) {
        weather = {
          windSpeed: 0,
          windDir: "N/A",
          relHumidity: 0
        }
      }
    }
  }
  
  // Ensure weather is not null
  if (!weather) {
    weather = {
      windSpeed: 0,
      windDir: "N/A",
      relHumidity: 0
    }
  }
  
  // Cache the result
  weatherCache.set(cacheKey, { data: weather, timestamp: now })
  return weather || { windSpeed: 0, windDir: "N/A", relHumidity: 0 }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const station = searchParams.get("station")
    const interval = searchParams.get("interval") as "24h" | "7d" || "24h"
    
    if (!station) {
      return NextResponse.json({ error: "Missing station parameter" }, { status: 400 })
    }

    // 1. Try to get measurements from database first
    const measurements = getMeasurementsForStation(station, interval)
    
    let result: Array<{
      time: string;
      las: number;
      ws: number;
      wd: string;
      rh: number;
    }> = []
    
    if (measurements.length === 0) {
      // Fallback to CSV parsing if no database data
      console.log(`📁 No database data for ${station}, using CSV fallback...`)
      result = parseCSVFallback(station, interval)
    } else {
      // 2. Get weather data for all time blocks (optimized)
      const weatherBlocks = measurements.map(m => roundTo5MinBlock(m.time))
      const uniqueWeatherBlocks = Array.from(new Set(weatherBlocks))
      
      // 3. Fetch weather data for missing blocks (with caching)
      const weatherPromises = uniqueWeatherBlocks.map(async (time) => {
        const weather = await getWeatherWithCache(station, time)
        return { time, weather }
      })
      
      const weatherResults = await Promise.all(weatherPromises)
      const weatherMap: Record<string, { windSpeed: number; windDir: string; relHumidity: number }> = Object.fromEntries(
        weatherResults.map(({ time, weather }) => [time, weather || { windSpeed: 0, windDir: "N/A", relHumidity: 0 }])
      )

      // 4. Combine measurements with weather data
      result = measurements.map(measurement => {
        const weather = weatherMap[roundTo5MinBlock(measurement.time)] || { windSpeed: 0, windDir: "N/A", relHumidity: 0 }
        return {
          time: measurement.time,
          las: measurement.las,
          ws: weather.windSpeed,
          wd: weather.windDir,
          rh: weather.relHumidity,
        }
      })
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('Error in station-data API:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
} 