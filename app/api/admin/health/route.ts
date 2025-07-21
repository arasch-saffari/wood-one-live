import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import os from 'os'
// Optional: import diskusage from 'diskusage' (wenn installiert)

export const runtime = 'nodejs'

export async function GET() {
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
      const db = require('@/lib/database').default
      const row = db.prepare('SELECT created_at FROM weather ORDER BY created_at DESC LIMIT 1').get()
      if (row && row.created_at) lastWeather = row.created_at
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
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Fehler beim Health-Check.' }, { status: 500 })
  }
} 