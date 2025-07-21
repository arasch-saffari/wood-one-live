import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const level = searchParams.get('level') // info, warn, error oder null
    const logPath = path.join(process.cwd(), 'logs', 'system.log')
    if (!fs.existsSync(logPath)) {
      return NextResponse.json({ lines: [] })
    }
    const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean)
    let filtered = lines
    if (level) {
      filtered = lines.filter(line => line.includes(`[${level.toUpperCase()}]`))
    }
    const last100 = filtered.slice(-100)
    return NextResponse.json({ lines: last100 })
  } catch (e: any) {
    return NextResponse.json({ lines: [], error: e?.message || 'Fehler beim Lesen der Logs.' }, { status: 500 })
  }
} 