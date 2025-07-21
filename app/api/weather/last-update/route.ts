import { NextResponse } from "next/server"
import db from '@/lib/database'

export async function GET() {
  try {
    // Hole das aktuellste time aus allen Wetterdaten
    const stmt = db.prepare('SELECT time, created_at FROM weather ORDER BY created_at DESC LIMIT 1')
    const row: any = stmt.get()
    if (!row || !row.time) {
      return NextResponse.json({ time: null, ago: null, iso: null })
    }
    // Zeit als Europe/Berlin interpretieren
    const now = new Date()
    const [h, m] = row.time.split(':').map(Number)
    const berlin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
    const diffMin = Math.floor((now.getTime() - berlin.getTime()) / 60000)
    let ago = 'gerade eben'
    if (diffMin === 1) ago = 'vor 1 Min'
    else if (diffMin > 1) ago = `vor ${diffMin} Min`
    return NextResponse.json({ time: row.time, ago, iso: row.time })
  } catch (e) {
    return NextResponse.json({ time: null, ago: null, iso: null })
  }
} 