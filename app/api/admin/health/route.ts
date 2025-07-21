import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

export async function GET() {
  try {
    // DB-Größe
    const dbPath = path.join(process.cwd(), 'data.sqlite')
    const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0
    // CSV-Watcher Status (Dummy, kann später aus Status-API gelesen werden)
    const watcherActive = true
    // Wetter-API letzter Abruf (Dummy, kann später aus DB gelesen werden)
    const lastWeather = null
    // Speicherplatz
    let diskFree = null, diskTotal = null
    try {
      const { freemem, totalmem } = await import('os')
      diskFree = freemem()
      diskTotal = totalmem()
    } catch {}
    return NextResponse.json({
      dbSize,
      watcherActive,
      lastWeather,
      diskFree,
      diskTotal,
      time: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Fehler beim Health-Check.' }, { status: 500 })
  }
} 