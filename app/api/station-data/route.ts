import { NextResponse } from "next/server";
import { getMeasurementsForStation, getWeatherForBlock, insertWeather, isWeatherDataOld, getRecentWeather } from "@/lib/db";
import { fetchWeather } from "@/lib/weather";
import Papa from "papaparse";
import fs from "fs";
import path from "path";

const configPath = path.join(process.cwd(), 'config.json')
function getConfig() {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// Weather cache for performance
const weatherCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function roundTo5MinBlock(time: string): string {
  const [h, m] = time.split(":");
  if (!h || !m) return time;
  const min = parseInt(m, 10);
  const blockMin = Math.floor(min / 5) * 5;
  return `${h.padStart(2, "0")}:${blockMin.toString().padStart(2, "0")}`;
}

function parseCSVFallback(station: string, interval: "24h" | "7d" = "24h") {
  try {
    const csvPath = path.join(process.cwd(), "data", `${station}.csv`);
    if (!fs.existsSync(csvPath)) return [];
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const parsed = Papa.parse(csvContent, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
    });
    let rows = parsed.data as Record<string, string>[];
    if (!Array.isArray(rows) || rows.length < 2) return [];
    rows = rows.slice(1); // drop first row
    const noiseColumn = station === "heuballern" ? "LAF" : "LAS";
    const validRows = rows.filter(
      (row) =>
        row["Systemzeit "] &&
        row[noiseColumn] &&
        !isNaN(Number(row[noiseColumn].replace(",", ".")))
    );
    const blocks: { [block: string]: number[] } = {};
    validRows.forEach((row) => {
      const sysTime = row["Systemzeit "]?.trim();
      const las = Number(row[noiseColumn].replace(",", "."));
      if (!sysTime || isNaN(las)) return;
      const [h, m] = sysTime.split(":");
      if (!h || !m) return;
      const blockTime = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
      if (!blocks[blockTime]) blocks[blockTime] = [];
      blocks[blockTime].push(las);
    });
    let result = Object.entries(blocks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, lasArr]) => {
        const las = Number((lasArr.reduce((a, b) => a + b, 0) / lasArr.length).toFixed(2));
        return {
          time,
          las,
          ws: 0,
          wd: "N/A",
          rh: 0,
        };
      });
    
    // Use dynamic limit based on interval and granularity
    let limit = 50; // fallback
    if (interval === "24h") {
      limit = 144; // reasonable default for 24h
    } else if (interval === "7d") {
      limit = 336; // reasonable default for 7d
    }
    
    return result.slice(-limit);
  } catch (e) {
    console.error(`Error parsing CSV fallback for ${station}:`, e);
    return [];
  }
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
      console.warn(`Failed to fetch weather from database for ${station} at ${time}:`, error);
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
    console.warn(`Weather service unavailable, using fallback data:`, error);
    
    // Try to get the most recent weather data from database
    try {
      const recentWeather = await getRecentWeather(station);
      if (recentWeather) {
        console.log(`Using recent weather data from database for ${station}`);
        weatherCache.set(cacheKey, { data: recentWeather, timestamp: Date.now() });
        return recentWeather;
      }
    } catch (dbError) {
      console.warn(`Failed to fetch recent weather from database for ${station}:`, dbError);
    }

    // Ultimate fallback to reasonable defaults
    console.log(`Using default fallback weather data for ${station}`);
    const fallbackData = {
      windSpeed: 0,
      windDir: 'N',
      relHumidity: 50, // More realistic default
      temperature: 15
    };
    weatherCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
    return fallbackData;
  }
}

export async function GET(req: Request) {
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
    console.log(`[${station}] Retrieved ${measurements.length} measurements for ${interval} interval with ${granularity} granularity`);
    
    function aggregateByBlock(measurements: { time: string; las: number }[], blockMinutes: number) {
      if (measurements.length === 0) {
        return [];
      }
      
      // For 1-hour granularity, we need to ensure we get proper 24-hour coverage
      if (blockMinutes === 60) {
        // Group by hour only, taking the most recent measurements for each hour
        const hourlyBlocks: Record<string, number[]> = {};
        
        // Process measurements in reverse order (most recent first) to ensure we get latest data per hour
        for (let i = measurements.length - 1; i >= 0; i--) {
          const m = measurements[i];
          const [h, mStr] = m.time.split(":");
          if (!h || !mStr) continue;
          
          const hourKey = h.padStart(2, "0");
          if (!hourlyBlocks[hourKey]) hourlyBlocks[hourKey] = [];
          hourlyBlocks[hourKey].push(m.las);
        }
        
        // Generate 24-hour sequence to ensure we have all hours represented
        const result = [];
        for (let hour = 0; hour < 24; hour++) {
          const hourKey = hour.toString().padStart(2, "0");
          const blockTime = `${hourKey}:00`;
          
          if (hourlyBlocks[hourKey] && hourlyBlocks[hourKey].length > 0) {
            const lasArr = hourlyBlocks[hourKey];
            result.push({
              time: blockTime,
              las: Number((lasArr.reduce((a, b) => a + b, 0) / lasArr.length).toFixed(2)),
            });
          }
        }
        return result;
      }
      
      // Original logic for other granularities
      const blocks: Record<string, number[]> = {};
      for (const m of measurements) {
        const [h, mStr] = m.time.split(":");
        if (!h || !mStr) continue;
        const min = parseInt(mStr, 10);
        const blockMin = Math.floor(min / blockMinutes) * blockMinutes;
        const blockTime = `${h.padStart(2, "0")}:${blockMin.toString().padStart(2, "0")}`;
        if (!blocks[blockTime]) blocks[blockTime] = [];
        blocks[blockTime].push(m.las);
      }
      const result = Object.entries(blocks)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([time, lasArr]) => {
          let las = 0;
          if (calculationMode === 'max') {
            las = Math.max(...lasArr);
          } else if (calculationMode === 'median') {
            const sorted = [...lasArr].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            las = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
          } else {
            las = lasArr.reduce((a, b) => a + b, 0) / lasArr.length;
          }
          return {
            time,
            las: Number(las.toFixed(2)),
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
    let result: Array<{
      time: string;
      las: number;
      ws: number;
      wd: string;
      rh: number;
      lasThreshold: number;
      lafThreshold: number;
      warningThreshold: number;
      alarmThreshold: number;
    }> = [];
    if (limitedAggregated.length === 0) {
      // parseCSVFallback liefert nur time, las, ws, wd, rh
      const fallback = parseCSVFallback(station, interval);
      result = fallback.map(row => ({
        ...row,
        lasThreshold,
        lafThreshold,
        warningThreshold,
        alarmThreshold,
      }));
    } else {
      const weatherBlocks = limitedAggregated.map(m => roundTo5MinBlock(m.time));
      const uniqueWeatherBlocks = Array.from(new Set(weatherBlocks));
      const weatherPromises = uniqueWeatherBlocks.map(async (time) => {
        const weather = await getWeatherWithCache(station, time);
        return { time, weather };
      });
      const weatherResults = await Promise.all(weatherPromises);
      const weatherMap: Record<string, { windSpeed: number; windDir: string; relHumidity: number }> = Object.fromEntries(
        weatherResults.map(({ time, weather }) => [time, weather])
      );
      result = limitedAggregated.map(measurement => {
        const w = weatherMap[roundTo5MinBlock(measurement.time)];
        const weather = (w && typeof w.windSpeed === 'number' && typeof w.windDir === 'string' && typeof w.relHumidity === 'number')
          ? { windSpeed: w.windSpeed, windDir: w.windDir, relHumidity: w.relHumidity, temperature: (w as any).temperature ?? 15 }
          : { windSpeed: 0, windDir: "N/A", relHumidity: 0, temperature: 15 };
        return {
          time: measurement.time,
          las: measurement.las,
          ws: weather.windSpeed,
          wd: weather.windDir,
          rh: weather.relHumidity,
          lasThreshold,
          lafThreshold,
          warningThreshold,
          alarmThreshold,
        };
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error('Error in station-data API:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
} 