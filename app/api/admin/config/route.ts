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
  csvAutoProcess: true,
  backupRetentionDays: 14,
  uiTheme: 'system', // 'light' | 'dark' | 'system'
  calculationMode: 'max', // 'max' | 'average' | 'median'
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
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Fehler beim Laden der Konfiguration.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const data = await req.json()
    // Nur erlaubte Felder speichern
    const allowed = { ...defaultConfig, ...data }
    fs.writeFileSync(configPath, JSON.stringify(allowed, null, 2))
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Fehler beim Speichern.' }, { status: 500 })
  }
} 