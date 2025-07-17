import { NextResponse } from "next/server";
import { getMeasurementsForStation, getWeatherForBlock, insertWeather, isWeatherDataOld } from "@/lib/db";
import { fetchWeather } from "@/lib/weather";
import Papa from "papaparse";
import fs from "fs";
import path from "path";

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
    const result = Object.entries(blocks).map(([time, lasArr]) => {
      const las = Number((lasArr.reduce((a, b) => a + b, 0) / lasArr.length).toFixed(2));
      return {
        time,
        las,
        ws: 0,
        wd: "N/A",
        rh: 0,
      };
    });
    // Begrenze auf maximal 50 Werte
    return result.slice(-50);
  } catch (e) {
    console.error(`Error parsing CSV fallback for ${station}:`, e);
    return [];
  }
}

async function getWeatherWithCache(station: string, time: string) {
  const cacheKey = `${station}-${time}`;
  const now = Date.now();
  const cached = weatherCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }
  let weather = getWeatherForBlock(station, time);
  if (!weather || isWeatherDataOld(station, time, 10)) {
    try {
      const live = await fetchWeather();
      insertWeather(
        station,
        time,
        live.windSpeed ?? 0,
        live.windDir ?? "N/A",
        live.relHumidity ?? 0
      );
      weather = getWeatherForBlock(station, time);
    } catch (e) {
      console.error('Failed to fetch weather:', e);
      if (!weather) {
        weather = {
          windSpeed: 0,
          windDir: "N/A",
          relHumidity: 0
        };
      }
    }
  }
  if (!weather) {
    weather = {
      windSpeed: 0,
      windDir: "N/A",
      relHumidity: 0
    };
  }
  weatherCache.set(cacheKey, { data: weather, timestamp: now });
  return weather;
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
    
    // Dynamische Chart-Limits je nach Zeitraum und Granularität
    // Ziel: Übersichtlichkeit + ausreichend Detailtiefe
    let chartLimit = 50; // Fallback
    
    if (interval === "24h") {
      if (granularity === "1min") chartLimit = 288; // 5 Detail (288 min = 40.8h)
      else if (granularity === "5min") chartLimit = 288; //24h vollständig (2885 = 24h)
      else if (granularity === "10min") chartLimit = 144; //24h vollständig (14410 = 24h)
      else if (granularity === "1h") chartLimit = 24; //24 vollständig (24 × 1h = 24h)
    } else if (interval === "7d") {
      if (granularity === "1min") chartLimit = 336; // 7d × 48 (30min-Intervalle für Übersicht)
      else if (granularity === "5min") chartLimit = 336; // 7d × 48 (30-Intervalle)
      else if (granularity === "10min") chartLimit = 336; // 7d × 48 (30-Intervalle)
      else if (granularity === "1h") chartLimit = 168; // 7d vollständig (168× 1h = 7d)
    }

    const measurements = getMeasurementsForStation(station, interval);
    function aggregateByBlock(measurements: { time: string; las: number }[], blockMinutes: number) {
      if (measurements.length === 0) {
        return [];
      }
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
        .map(([time, lasArr]) => ({
          time,
          las: Number((lasArr.reduce((a, b) => a + b, 0) / lasArr.length).toFixed(2)),
        }));
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
    }> = [];
    if (limitedAggregated.length === 0) {
      result = parseCSVFallback(station, interval);
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
          ? w
          : { windSpeed: 0, windDir: "N/A", relHumidity: 0 };
        return {
          time: measurement.time,
          las: measurement.las,
          ws: weather.windSpeed,
          wd: weather.windDir,
          rh: weather.relHumidity,
        };
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error('Error in station-data API:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
} 