import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import db from '@/lib/db'

export const runtime = 'nodejs'

const configPath = path.join(process.cwd(), 'config.json')

const defaultConfig = {
  warningThreshold: 55,
  alarmThreshold: 60,
  lasThreshold: 50,
  lafThreshold: 52,
  stations: ['ort', 'techno', 'heuballern', 'band'],
  enableNotifications: false,
  csvAutoProcess: true,
  backupRetentionDays: 14,
  uiTheme: 'system', // 'light' | 'dark' | 'system'
  calculationMode: 'max', // 'max' | 'average' | 'median'
  adminEmail: '',
  weatherApiKey: '',
  apiCacheDuration: 60, // Sekunden, wie lange API-Responses gecacht werden
  pollingIntervalSeconds: 120, // NEU: Polling-Intervall für Charts in Sekunden
  chartLimit: 200, // Maximale Datenpunkte pro Chart
  pageSize: 20, // Standard-Pagination-Größe
  defaultInterval: '24h', // Standard-Intervall
  defaultGranularity: '15min', // Standard-Granularität
  allowedIntervals: ['24h', '7d'],
  allowedGranularities: ['1h', '15min', '10min', '5min', '1min'],
  chartColors: {
    primary: '#8b5cf6',
    wind: '#06b6d4',
    humidity: '#10b981',
    temperature: '#f59e0b',
    warning: '#facc15',
    danger: '#f87171',
    alarm: '#f87171',
    reference: '#94a3b8',
    gradients: {
      primary: { from: '#8b5cf6', to: '#a78bfa' },
      secondary: { from: '#06b6d4', to: '#67e8f9' }
    }
  },
  thresholdsByStationAndTime: {
    ort: [
      { from: '08:00', to: '20:00', warning: 55, alarm: 60, las: 50, laf: 52 },
      { from: '20:00', to: '08:00', warning: 50, alarm: 55, las: 48, laf: 50 },
    ],
    techno: [
      { from: '08:00', to: '20:00', warning: 60, alarm: 65, las: 55, laf: 57 },
      { from: '20:00', to: '08:00', warning: 55, alarm: 60, las: 52, laf: 54 },
    ],
    heuballern: [
      { from: '08:00', to: '20:00', warning: 58, alarm: 63, las: 53, laf: 55 },
      { from: '20:00', to: '08:00', warning: 53, alarm: 58, las: 50, laf: 52 },
    ],
    band: [
      { from: '08:00', to: '20:00', warning: 57, alarm: 62, las: 52, laf: 54 },
      { from: '20:00', to: '08:00', warning: 52, alarm: 57, las: 49, laf: 51 },
    ],
  },
}

type ThresholdBlock = { from: string; to: string; warning: number; alarm: number; las: number; laf: number }
type ThresholdBlockDb = { id: number; station: string; from_time: string; to_time: string; warning: number; alarm: number; las: number; laf: number }
async function getThresholdsFromDb() {
  const rows = db.prepare('SELECT * FROM thresholds').all() as Array<{ station: string; from_time: string; to_time: string; warning: number; alarm: number; las: number; laf: number }>
  const grouped: Record<string, ThresholdBlock[]> = {}
  for (const row of rows) {
    if (!grouped[row.station]) grouped[row.station] = []
    grouped[row.station].push({
      from: row.from_time,
      to: row.to_time,
      warning: row.warning,
      alarm: row.alarm,
      las: row.las,
      laf: row.laf,
    })
  }
  return grouped
}

async function setThresholdsToDb(thresholds: Record<string, { from: string; to: string; warning: number; alarm: number; las?: number; laf?: number }[]>) {
  const tx = db.transaction(() => {
    for (const station of Object.keys(thresholds)) {
      for (const block of thresholds[station]) {
        // Prüfe, ob es einen bestehenden Eintrag gibt
        const existing = db.prepare('SELECT * FROM thresholds WHERE station = ? AND from_time = ? AND to_time = ?').get(station, block.from, block.to) as ThresholdBlockDb | undefined
        let action: 'insert' | 'update' = 'insert'
        if (existing) {
          action = 'update'
        }
        db.prepare(`INSERT OR REPLACE INTO thresholds (station, from_time, to_time, warning, alarm, las, laf, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`).run(
          station,
          block.from,
          block.to,
          block.warning,
          block.alarm,
          block.las ?? null,
          block.laf ?? null
        )
        // Audit-Log schreiben
        db.prepare(`INSERT INTO thresholds_audit (threshold_id, station, from_time, to_time, old_warning, new_warning, old_alarm, new_alarm, old_las, new_las, old_laf, new_laf, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(
            existing?.id ?? null,
            station,
            block.from,
            block.to,
            existing?.warning ?? null,
            block.warning,
            existing?.alarm ?? null,
            block.alarm,
            existing?.las ?? null,
            block.las ?? null,
            existing?.laf ?? null,
            block.laf ?? null,
            action
          )
      }
    }
  })
  tx()
}

async function migrateThresholdsFromConfigJsonIfNeeded() {
  const count = db.prepare('SELECT COUNT(*) as count FROM thresholds').get() as { count: number }
  if (count.count === 0 && fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (config.thresholdsByStationAndTime) {
      await setThresholdsToDb(config.thresholdsByStationAndTime)
    }
  }
}

export async function GET() {
  try {
    await migrateThresholdsFromConfigJsonIfNeeded()
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2))
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    // Hole Schwellenwerte aus DB
    config.thresholdsByStationAndTime = await getThresholdsFromDb()
    // Füge fehlende Felder aus defaultConfig hinzu (Migration)
    const merged = { ...defaultConfig, ...config }
    if (JSON.stringify(merged) !== JSON.stringify(config)) {
      fs.writeFileSync(configPath, JSON.stringify(merged, null, 2))
    }
    return NextResponse.json(merged)
  } catch (e: unknown) {
    const error = e as Error
    return NextResponse.json({ error: error.message || 'Fehler beim Laden der Konfiguration.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const data = await req.json()
    // Nur erlaubte Felder speichern
    const allowed = { ...defaultConfig, ...data }
    // Schwellenwerte in DB speichern
    if (allowed.thresholdsByStationAndTime) {
      await setThresholdsToDb(allowed.thresholdsByStationAndTime)
    }
    // Entferne thresholdsByStationAndTime aus JSON-Datei, da sie jetzt in DB liegen
    const jsonConfig = { ...allowed }
    delete jsonConfig.thresholdsByStationAndTime
    fs.writeFileSync(configPath, JSON.stringify(jsonConfig, null, 2))
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const error = e as Error
    return NextResponse.json({ success: false, message: error.message || 'Fehler beim Speichern.', notify: true }, { status: 500 })
  }
}

// API-Endpoint: /api/admin/thresholds/audit
type ThresholdsAuditRow = {
  id: number;
  threshold_id: number | null;
  station: string;
  from_time: string;
  to_time: string;
  old_warning: number | null;
  new_warning: number | null;
  old_alarm: number | null;
  new_alarm: number | null;
  old_las: number | null;
  new_las: number | null;
  old_laf: number | null;
  new_laf: number | null;
  changed_at: string;
  action: 'insert' | 'update' | 'delete';
}
export async function GET_AUDIT() {
  try {
    const rows = db.prepare('SELECT * FROM thresholds_audit ORDER BY changed_at DESC LIMIT 100').all() as ThresholdsAuditRow[]
    return NextResponse.json({ rows })
  } catch (e: unknown) {
    const error = e as Error
    return NextResponse.json({ rows: [], error: error.message || 'Fehler beim Laden des Audit-Logs.' }, { status: 500 })
  }
} 