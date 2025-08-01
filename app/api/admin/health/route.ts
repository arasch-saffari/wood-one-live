import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import os from 'os'
// Optional: import diskusage from 'diskusage' (wenn installiert)
import db from '@/lib/database'
import { initializeApplication } from '@/lib/app-init'

let initialized = false

export const runtime = 'nodejs'

export async function GET() {
  // Initialize application on first API call
  if (!initialized) {
    try {
      initializeApplication()
      initialized = true
    } catch (error) {
      console.error('Application initialization failed:', error)
      // Continue anyway, don't fail the health check
    }
  }

  try {
    // DB-Größe
    const dbPath = path.join(process.cwd(), 'data.sqlite')
    const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0
    // Letztes Backup
    const backupDir = path.join(process.cwd(), 'backups')
    let lastBackup = null
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sqlite'))
      if (files.length > 0) {
        const latest = files.map(f => ({ f, t: fs.statSync(path.join(backupDir, f)).mtimeMs }))
          .sort((a, b) => b.t - a.t)[0]
        lastBackup = latest ? fs.statSync(path.join(backupDir, latest.f)).mtime.toISOString() : null
      }
    }
    // Speicherplatz (Disk, Fallback: RAM)
    let diskFree = null, diskTotal = null
    try {
      // Wenn diskusage installiert ist, kann man so ermitteln:
      // const { free, total } = await diskusage.check(process.cwd())
      // diskFree = free; diskTotal = total;
      // Fallback: RAM
      diskFree = os.freemem()
      diskTotal = os.totalmem()
    } catch {}
    // Watcher-Status
    let watcherActive = false, watcherHeartbeat = null
    try {
      const heartbeatPath = path.join(process.cwd(), 'backups', 'watcher-heartbeat.txt')
      if (fs.existsSync(heartbeatPath)) {
        watcherHeartbeat = fs.readFileSync(heartbeatPath, 'utf-8')
        watcherActive = true
      }
    } catch {}
    // Letzter Wetterabruf
    let lastWeather = null
    try {
      const row = db.prepare('SELECT created_at FROM weather ORDER BY created_at DESC LIMIT 1').get() as { created_at?: string } | undefined
      if (row && row.created_at) lastWeather = row.created_at
    } catch {}
    // Integritäts-Check: Messungen mit NULL in NOT NULL-Spalten
    let integrityProblem = false, integrityCount = 0
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM measurements WHERE station IS NULL OR time IS NULL OR las IS NULL').get() as { count?: number } | undefined
      if (row && row.count && row.count > 0) {
        integrityProblem = true
        integrityCount = row.count
      }
    } catch {}
    return NextResponse.json({
      dbSize,
      lastBackup,
      diskFree,
      diskTotal,
      time: new Date().toISOString(),
      watcherActive,
      watcherHeartbeat,
      lastWeather,
      integrityProblem,
      integrityCount,
      notify: integrityProblem ? true : undefined,
    })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Fehler beim Health-Check.'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
} 