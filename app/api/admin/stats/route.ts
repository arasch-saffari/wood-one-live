import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import db from '@/lib/database'

export const runtime = 'nodejs'

export async function GET() {
  try {
    // Messwerte
    const measurements = db.prepare('SELECT COUNT(*) as count FROM measurements').get().count
    // Wetterdaten
    const weather = db.prepare('SELECT COUNT(*) as count FROM weather').get().count
    // CSV-Dateien pro Station
    const stations = ['ort', 'techno', 'heuballern', 'band']
    const csvCounts: Record<string, number> = {}
    for (const station of stations) {
      const dir = path.join(process.cwd(), 'public', 'csv', station)
      csvCounts[station] = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.csv')).length : 0
    }
    // DB-Größe
    const dbPath = path.join(process.cwd(), 'data.sqlite')
    const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0
    return NextResponse.json({ measurements, weather, csvCounts, dbSize })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Fehler bei den Statistiken.' }, { status: 500 })
  }
} 