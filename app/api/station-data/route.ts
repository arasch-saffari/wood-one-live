import { NextResponse } from "next/server";
import { getMeasurementsForStation } from "@/lib/db";
import fs from "fs";
import path from "path";
import db from '@/lib/database'
import { apiLatency } from '../metrics/route'
import { initializeApplication } from '@/lib/app-init'

// Initialize application on first API call
let initialized = false

// File-Cache für große Zeiträume
const CACHE_DIR = path.join(process.cwd(), 'cache')
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
}

export async function GET(req: Request) {
  // Initialize application on first API call
  if (!initialized) {
    try {
      initializeApplication()
      initialized = true
    } catch (error) {
      console.error('Application initialization failed:', error)
      // Continue anyway, don't fail the API call
    }
  }

  const apiLatencyEnd = apiLatency.startTimer({ route: '/api/station-data' })
  const { searchParams } = new URL(req.url)
  const station = searchParams.get("station")
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
  const pageSize = Math.min(10000, Math.max(1, parseInt(searchParams.get("pageSize") || "1000", 10)))
  const aggregate = searchParams.get("aggregate")
  const interval = (searchParams.get("interval") as "24h" | "7d") || "24h"
  const sortBy = searchParams.get("sortBy") as 'time' | 'las' | 'datetime' || 'datetime'
  const sortOrder = searchParams.get("sortOrder") as 'asc' | 'desc' || 'desc'
  if (!station) {
    apiLatencyEnd()
    return NextResponse.json({ error: "Missing station parameter" }, { status: 400 });
  }
  if (searchParams.get('aggregate') === 'kpi') {
    // KPI-Aggregation für 24h (schnell per SQL)
    const station = searchParams.get('station')
    const row = db.prepare(`
      SELECT MAX(las) as max, AVG(las) as avg, MIN(las) as min,
        COUNT(*) as count
      FROM measurements
      WHERE station = ? AND datetime >= datetime('now', '-24 hours')
    `).get(station) as { max: number, avg: number, min: number, count: number }
    
    apiLatencyEnd();
    
    if (!row || row.max == null || row.count === 0) {
      return NextResponse.json({ max: 0, avg: 0, trend: 0 })
    }
    
    // Division-durch-Null abfangen
    let trend = 0
    if (row.min > 0) {
      trend = ((row.max - row.min) / row.min) * 100
    } else if (row.max > 0) {
      trend = 100 // 100% Anstieg wenn von 0 auf einen Wert
    }
    
    return NextResponse.json({ 
      max: row.max, 
      avg: row.avg, 
      trend: Math.round(trend * 100) / 100 // Auf 2 Dezimalstellen runden
    })
  }
  // Aggregation: minütliche Mittelwerte
  if (aggregate === "minutely") {
    // SQL-Level-Pagination auch für minutely aggregation
    const stmt = db.prepare(`
      SELECT strftime('%Y-%m-%d %H:%M:00', datetime) as bucket, AVG(las) as avgLas
      FROM measurements
      WHERE station = ? AND datetime >= datetime('now', '-${interval === '7d' ? '7 days' : '24 hours'}')
      GROUP BY bucket
      ORDER BY bucket ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `)
    
    const countStmt = db.prepare(`
      SELECT COUNT(DISTINCT strftime('%Y-%m-%d %H:%M:00', datetime)) as total
      FROM measurements
      WHERE station = ? AND datetime >= datetime('now', '-${interval === '7d' ? '7 days' : '24 hours'}')
    `)
    
    const offset = (page - 1) * pageSize
    const paged = stmt.all(station, pageSize, offset) as Array<{ bucket: string, avgLas: number }>
    const countResult = countStmt.get(station) as { total: number }
    
    apiLatencyEnd()
    return NextResponse.json({ 
      data: paged, 
      totalCount: countResult.total, 
      page, 
      pageSize 
    })
  }
  if (aggregate === "15min") {
    // Prüfe zuerst, ob Daten in der aggregierten Tabelle vorhanden sind
    const aggCountStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM measurements_15min_agg
      WHERE station = ? AND bucket >= datetime('now', '-${interval === '7d' ? '7 days' : '24 hours'}')
    `)
    
    const aggCountResult = aggCountStmt.get(station) as { total: number }
    
    // Reduziere Schwellenwert von 40 auf 20 für bessere Verfügbarkeit
    const MIN_AGGREGATE_ENTRIES = 20
    
    // Wenn aggregierte Daten vorhanden sind UND genug Einträge, verwende sie
    if (aggCountResult.total >= MIN_AGGREGATE_ENTRIES) {
      console.log(`[API station-data] Verwende 15min aggregierte Daten für ${station}: ${aggCountResult.total} Einträge`)
      
      const stmt = db.prepare(`
        SELECT bucket, avgLas
        FROM measurements_15min_agg
        WHERE station = ? AND bucket >= datetime('now', '-${interval === '7d' ? '7 days' : '24 hours'}')
        ORDER BY bucket ${sortOrder.toUpperCase()}
        LIMIT ? OFFSET ?
      `)
      
      const offset = (page - 1) * pageSize
      const results = stmt.all(station, pageSize, offset) as Array<{ bucket: string, avgLas: number }>
      
      const paged = results.map(b => ({
        time: b.bucket.slice(11, 16),
        las: b.avgLas,
        datetime: b.bucket
      }))
      
      apiLatencyEnd()
      return NextResponse.json({ 
        data: paged, 
        totalCount: aggCountResult.total, 
        page, 
        pageSize,
        aggregation_state: "ok",
        aggregation_count: aggCountResult.total
      })
    }
    
    // Wenn keine oder zu wenige aggregierten Daten vorhanden sind, verwende direkte Messwerte
    // ABER: Gruppiere sie in 15-Minuten-Intervallen
    console.log(`[API station-data] Keine ausreichenden aggregierten Daten für ${station} (${aggCountResult.total} Einträge), verwende 15min gruppierte Rohdaten`)
    
    // Prüfe ob datetime Spalte existiert
    const columns = db.prepare("PRAGMA table_info(measurements)").all() as Array<{ name: string }>
    const hasDatetime = columns.some(col => col.name === 'datetime')
    
    if (!hasDatetime) {
      console.log(`[API station-data] Keine datetime Spalte für ${station}, verwende alle Daten in 15min Gruppen`)
      // Fallback: Verwende alle Daten in 15-Minuten-Intervallen gruppiert
      const stmt = db.prepare(`
        SELECT 
          strftime('%Y-%m-%d %H:%M:00', time, '-' || (CAST(strftime('%M', time) AS INTEGER) % 15) || ' minutes') as bucket,
          AVG(las) as avgLas
        FROM measurements
        WHERE station = ?
        GROUP BY bucket
        ORDER BY bucket ${sortOrder.toUpperCase()}
        LIMIT ? OFFSET ?
      `)
      
      const offset = (page - 1) * pageSize
      const results = stmt.all(station, pageSize, offset) as Array<{ bucket: string, avgLas: number }>
      
      const paged = results.map(b => ({
        time: b.bucket.slice(11, 16),
        las: b.avgLas,
        datetime: b.bucket
      }))
      
      apiLatencyEnd()
      return NextResponse.json({ 
        data: paged, 
        totalCount: results.length, 
        page, 
        pageSize,
        aggregation_state: "fallback_15min_grouped",
        aggregation_count: aggCountResult.total
      })
    }
    
    // Prüfe zuerst 24h, dann 7d falls keine Daten vorhanden
    let timeFilter = "datetime('now', '-24 hours')"
    let countStmt = db.prepare(`
      SELECT COUNT(DISTINCT strftime('%Y-%m-%d %H:%M:00', datetime, '-' || (CAST(strftime('%M', datetime) AS INTEGER) % 15) || ' minutes')) as total
      FROM measurements
      WHERE station = ? AND datetime >= ${timeFilter}
    `)
    
    let countResult = countStmt.get(station) as { total: number }
    
    // Falls keine Daten in den letzten 24h, verwende 7d
    if (countResult.total === 0) {
      console.log(`[API station-data] Keine Daten in den letzten 24h für ${station}, verwende 7d`)
      timeFilter = "datetime('now', '-7 days')"
      countStmt = db.prepare(`
        SELECT COUNT(DISTINCT strftime('%Y-%m-%d %H:%M:00', datetime, '-' || (CAST(strftime('%M', datetime) AS INTEGER) % 15) || ' minutes')) as total
        FROM measurements
        WHERE station = ? AND datetime >= ${timeFilter}
      `)
      countResult = countStmt.get(station) as { total: number }
    }
    
    // WICHTIG: Gruppiere in 15-Minuten-Intervallen, nicht pro Minute
    const stmt = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:%M:00', datetime, '-' || (CAST(strftime('%M', datetime) AS INTEGER) % 15) || ' minutes') as bucket,
        AVG(las) as avgLas
      FROM measurements
      WHERE station = ? AND datetime >= ${timeFilter}
      GROUP BY strftime('%Y-%m-%d %H:%M:00', datetime, '-' || (CAST(strftime('%M', datetime) AS INTEGER) % 15) || ' minutes')
      ORDER BY bucket ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `)
    
    const offset = (page - 1) * pageSize
    const results = stmt.all(station, pageSize, offset) as Array<{ bucket: string, avgLas: number }>
    
    const paged = results.map(b => ({
      time: b.bucket.slice(11, 16),
      las: b.avgLas,
      datetime: b.bucket
    }))
    
    apiLatencyEnd()
    return NextResponse.json({ 
      data: paged, 
      totalCount: countResult.total, 
      page, 
      pageSize,
      aggregation_state: "fallback_15min_grouped",
      aggregation_count: aggCountResult.total
    })
  }
  // Aggregation: 15min-Alarme (optimiert mit SQL-Level-Filtering)
  if (aggregate === "alarms") {
    let stationKey = station;
    if (stationKey === "techno") stationKey = "techno";
    if (stationKey === "band") stationKey = "band";
    
    // SQL-Query mit JOIN zu Thresholds für bessere Performance
    const stmt = db.prepare(`
      WITH time_buckets AS (
        SELECT 
          agg.bucket,
          agg.avgLas,
          CAST(substr(agg.bucket, 12, 2) AS INTEGER) * 60 + 
          CAST(substr(agg.bucket, 15, 2) AS INTEGER) as minutes_since_midnight
        FROM measurements_15min_agg agg
        WHERE agg.station = ? 
        AND agg.bucket >= datetime('now', '-${interval === '7d' ? '7 days' : '24 hours'}')
      ),
      threshold_matches AS (
        SELECT 
          tb.*,
          t.alarm_threshold,
          CAST(substr(t.from_time, 1, 2) AS INTEGER) * 60 + 
          CAST(substr(t.from_time, 4, 2) AS INTEGER) as from_minutes,
          CAST(substr(t.to_time, 1, 2) AS INTEGER) * 60 + 
          CAST(substr(t.to_time, 4, 2) AS INTEGER) as to_minutes
        FROM time_buckets tb
        JOIN thresholds t ON t.station = ?
        WHERE (
          (t.from_time <= t.to_time AND tb.minutes_since_midnight >= 
           (CAST(substr(t.from_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.from_time, 4, 2) AS INTEGER))
           AND tb.minutes_since_midnight < 
           (CAST(substr(t.to_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.to_time, 4, 2) AS INTEGER)))
          OR
          (t.from_time > t.to_time AND (tb.minutes_since_midnight >= 
           (CAST(substr(t.from_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.from_time, 4, 2) AS INTEGER))
           OR tb.minutes_since_midnight < 
           (CAST(substr(t.to_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.to_time, 4, 2) AS INTEGER))))
        )
        AND tb.avgLas >= t.alarm_threshold
      )
      SELECT bucket, avgLas
      FROM threshold_matches
      ORDER BY bucket ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `)
    
    const countStmt = db.prepare(`
      WITH time_buckets AS (
        SELECT 
          agg.bucket,
          agg.avgLas,
          CAST(substr(agg.bucket, 12, 2) AS INTEGER) * 60 + 
          CAST(substr(agg.bucket, 15, 2) AS INTEGER) as minutes_since_midnight
        FROM measurements_15min_agg agg
        WHERE agg.station = ? 
        AND agg.bucket >= datetime('now', '-${interval === '7d' ? '7 days' : '24 hours'}')
      )
      SELECT COUNT(*) as total
      FROM time_buckets tb
      JOIN thresholds t ON t.station = ?
      WHERE (
        (t.from_time <= t.to_time AND tb.minutes_since_midnight >= 
         (CAST(substr(t.from_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.from_time, 4, 2) AS INTEGER))
         AND tb.minutes_since_midnight < 
         (CAST(substr(t.to_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.to_time, 4, 2) AS INTEGER)))
        OR
        (t.from_time > t.to_time AND (tb.minutes_since_midnight >= 
         (CAST(substr(t.from_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.from_time, 4, 2) AS INTEGER))
         OR tb.minutes_since_midnight < 
         (CAST(substr(t.to_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.to_time, 4, 2) AS INTEGER))))
      )
      AND tb.avgLas >= t.alarm_threshold
    `)
    
    const offset = (page - 1) * pageSize
    const results = stmt.all(stationKey, stationKey, pageSize, offset) as Array<{ bucket: string, avgLas: number }>
    const countResult = countStmt.get(stationKey, stationKey) as { total: number }
    
    const paged = results.map(b => ({
      time: b.bucket.slice(11, 16),
      las: b.avgLas,
      datetime: b.bucket
    }))
    
    apiLatencyEnd();
    return NextResponse.json({ 
      data: paged, 
      totalCount: countResult.total, 
      page, 
      pageSize 
    });
  }
  // Direkte SQL-Level-Pagination ohne Cache für bessere Performance
  try {
    // Debug-Logging für Deployment
    console.log(`🔍 [API station-data] Request: station=${station}, interval=${interval}, page=${page}, pageSize=${pageSize}, aggregate=${aggregate}`)
    console.log(`🔍 [API station-data] Environment: NODE_ENV=${process.env.NODE_ENV}, Platform=${process.platform}`)
    
    // console.log(`[DEBUG] API station-data called with station: ${station}, page: ${page}, pageSize: ${pageSize}`) // Added and removed
    
    const paginatedResult = getMeasurementsForStation(station, {
      page: page,
      pageSize: pageSize,
      sortBy: sortBy,
      sortOrder: sortOrder,
      timeFilter: interval === '7d' ? '7d' : '24h'
    })
    
    // console.log(`[DEBUG] getMeasurementsForStation returned:`, { // Added and removed
    //   totalCount: paginatedResult.totalCount,
    //   dataLength: paginatedResult.data.length,
    //   page: paginatedResult.page,
    //   pageSize: paginatedResult.pageSize
    // })
    
    const result = paginatedResult.data.map(m => ({
      time: m.time,
      las: m.las,
      datetime: m.datetime || `${new Date().toISOString().slice(0, 10)} ${m.time}`, // Fallback wenn datetime fehlt
      ws: m.ws,
      wd: m.wd,
      rh: m.rh,
    }));
    
    // console.log(`[DEBUG] Final result length: ${result.length}`) // Added and removed
    
    // Debug-Logging für Deployment
    console.log(`🔍 [API station-data] Result: ${result.length} rows for ${station}, totalCount: ${paginatedResult.totalCount}`)
    
    // Zusätzliche Debug-Informationen für techno und band
    if (station === 'techno' || station === 'band') {
      console.log(`🔍 [API station-data] Special debug for ${station}:`)
      console.log(`🔍 [API station-data] - Total count: ${paginatedResult.totalCount}`)
      console.log(`🔍 [API station-data] - Result length: ${result.length}`)
      if (result.length > 0) {
        console.log(`🔍 [API station-data] - First result: ${JSON.stringify(result[0])}`)
        console.log(`🔍 [API station-data] - Last result: ${JSON.stringify(result[result.length - 1])}`)
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API station-data] Station: ${station}, Page: ${page}/${paginatedResult.totalPages}, Rows: ${result.length}/${paginatedResult.totalCount}`)
    }
    
    apiLatencyEnd()
    return NextResponse.json({ 
      data: result, 
      totalCount: paginatedResult.totalCount, 
      page: paginatedResult.page, 
      pageSize: paginatedResult.pageSize,
      totalPages: paginatedResult.totalPages
    })
  } catch (error) {
    console.error(`❌ Error fetching station data for ${station}:`, error)
    apiLatencyEnd()
    return NextResponse.json({ error: 'Failed to fetch station data' }, { status: 500 })
  }
} 