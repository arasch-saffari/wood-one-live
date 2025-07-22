import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

const configPath = path.join(process.cwd(), 'config.json')

const defaultConfig = {
  warningThreshold: 55,
  alarmThreshold: 60,
  lasThreshold: 50,
  lafThreshold: 52,
  stations: ['ort', 'techno', 'heuballern', 'band'],
  enableNotifications: false,
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

export async function GET() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2))
      return NextResponse.json(defaultConfig)
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
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
    fs.writeFileSync(configPath, JSON.stringify(allowed, null, 2))
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const error = e as Error
    return NextResponse.json({ success: false, message: error.message || 'Fehler beim Speichern.', notify: true }, { status: 500 })
  }
} 