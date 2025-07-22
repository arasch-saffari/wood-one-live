import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import db from '@/lib/database'

export const runtime = 'nodejs'

export async function GET() {
  try {
    // Messwerte
    const measurements = (db.prepare('SELECT COUNT(*) as count FROM measurements').get() as { count: number }).count
    // Wetterdaten
    const weather = (db.prepare('SELECT COUNT(*) as count FROM weather').get() as { count: number }).count
    // TXT-Dateien pro Station
    const stations = ['ort', 'techno', 'heuballern', 'band']
    const txtCounts: Record<string, number> = {}
    for (const station of stations) {
      const dir = path.join(process.cwd(), 'public', 'txt', station)
      txtCounts[station] = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.txt')).length : 0
    }
    // DB-Größe
    const dbPath = path.join(process.cwd(), 'data.sqlite')
    const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0
    return NextResponse.json({ measurements, weather, txtCounts, dbSize })
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json({ error: error.message || 'Fehler bei den Statistiken.' }, { status: 500 })
  }
} 