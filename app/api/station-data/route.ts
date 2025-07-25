import { NextResponse } from "next/server";
import { getMeasurementsForStation } from "@/lib/db";
import fs from "fs";
import path from "path";
import db from '@/lib/database'
import { getMinuteAveragesForStation, get15MinAveragesForStation } from '@/lib/db'
import { apiLatency } from '../metrics/route'

// File-Cache für große Zeiträume
const CACHE_DIR = path.join(process.cwd(), 'cache')
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
}
const FILE_CACHE_DURATION_MS = 5 * 60 * 1000 // 5 Minuten

export async function GET(req: Request) {
  const apiLatencyEnd = apiLatency.startTimer({ route: '/api/station-data' })
  const { searchParams } = new URL(req.url)
  const station = searchParams.get("station")
  const page = parseInt(searchParams.get("page") || "1", 10)
  const pageSize = parseInt(searchParams.get("pageSize") || "1000", 10)
  const aggregate = searchParams.get("aggregate")
  const interval = (searchParams.get("interval") as "24h" | "7d") || "24h"
  if (!station) {
    apiLatencyEnd()
    return NextResponse.json({ error: "Missing station parameter" }, { status: 400 });
  }
  if (searchParams.get('aggregate') === 'kpi') {
    // KPI-Aggregation für 24h (schnell per SQL)
    const station = searchParams.get('station')
    const row = db.prepare(`
      SELECT MAX(las) as max, AVG(las) as avg,
        (MAX(las) - MIN(las)) * 100.0 / MIN(las) as trend
      FROM measurements
      WHERE station = ? AND datetime >= datetime('now', '-24 hours')
    `).get(station) as { max: number, avg: number, trend: number }
    apiLatencyEnd();
    if (!row || row.max == null) return NextResponse.json({ max: 0, avg: 0, trend: 0 })
    return NextResponse.json(row)
  }
  // Aggregation: minütliche Mittelwerte
  if (aggregate === "minutely") {
    const minuteAverages = getMinuteAveragesForStation(station, interval)
    const totalCount = minuteAverages.length
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paged = minuteAverages.slice(start, end)
    // Rückgabe: bucket statt minute
    apiLatencyEnd()
    return NextResponse.json({ data: paged, totalCount, page, pageSize })
  }
  if (aggregate === "15min") {
    const min15Averages = get15MinAveragesForStation(station, interval)
    // Sortiere absteigend nach datetime
    min15Averages.sort((a, b) => b.bucket.localeCompare(a.bucket));
    const totalCount = min15Averages.length
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paged = min15Averages.slice(start, end).map(b => ({
      time: b.bucket.slice(11, 16),
      las: b.avgLas,
      datetime: b.bucket
    }))
    apiLatencyEnd()
    return NextResponse.json({ data: paged, totalCount, page, pageSize })
  }
  // Aggregation: 15min-Alarme (wie im All-Dashboard)
  if (aggregate === "alarms") {
    // Hole 15-Minuten-Aggregation
    const min15Averages = get15MinAveragesForStation(station, interval)
    // Sortiere absteigend nach datetime
    min15Averages.sort((a, b) => b.bucket.localeCompare(a.bucket));
    // Hole Schwellenwerte für die Station
    // (Wir nehmen die aktuelle Zeit nicht, sondern prüfen für jeden Bucket die passende Schwelle)
    // Lade Config aus Datei (wie im Dashboard)
    let config: any = null;
    try {
      config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf-8'));
    } catch {}
    let stationKey = station;
    if (stationKey === "techno") stationKey = "techno";
    if (stationKey === "band") stationKey = "band";
    // Hilfsfunktion: Hole Alarm-Schwelle für eine Zeit
    function getAlarmThresholdForTime(stationKey: string, time: string): number | undefined {
      if (!config?.thresholdsByStationAndTime || !stationKey || !time) return undefined;
      const blocks = config.thresholdsByStationAndTime[stationKey];
      if (!blocks) return undefined;
      const [h, m] = time.split(":").map(Number);
      const minutes = h * 60 + m;
      for (const block of blocks) {
        const [fromH, fromM] = block.from.split(":").map(Number);
        const [toH, toM] = block.to.split(":").map(Number);
        const fromMin = fromH * 60 + fromM;
        const toMin = toH * 60 + toM;
        if (fromMin < toMin) {
          if (minutes >= fromMin && minutes < toMin) return block.alarm;
        } else {
          if (minutes >= fromMin || minutes < toMin) return block.alarm;
        }
      }
      return blocks[0]?.alarm;
    }
    // Filtere alle Zeilen, die als Alarm gelten
    const alarmRows = min15Averages.filter(b => {
      const time = b.bucket.slice(11, 16);
      const alarm = getAlarmThresholdForTime(stationKey, time);
      return typeof alarm === 'number' && b.avgLas >= alarm;
    }).map(b => ({
      time: b.bucket.slice(11, 16),
      las: b.avgLas,
      datetime: b.bucket
    }));
    const totalCount = alarmRows.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paged = alarmRows.slice(start, end);
    apiLatencyEnd();
    return NextResponse.json({ data: paged, totalCount, page, pageSize });
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
    apiLatencyEnd()
    return NextResponse.json({ data: [], totalCount: 0, page, pageSize })
  }
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const pagedData = allData.data.slice(start, end)
  console.log(`[API station-data] Station: ${station}, Rohdaten: ${allData.totalCount}, usedCache: ${usedCache}`)
  apiLatencyEnd()
  return NextResponse.json({ data: pagedData, totalCount: allData.totalCount, page, pageSize });
} 