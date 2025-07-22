import { NextResponse } from "next/server"
import db from '@/lib/database'

export async function GET() {
  try {
    // Hole das aktuellste created_at aus allen Wetterdaten
    const stmt = db.prepare('SELECT created_at FROM weather ORDER BY created_at DESC LIMIT 1')
    const row: unknown = stmt.get()
    if (!row || !row.created_at) {
      return NextResponse.json({ time: null, ago: null, iso: null, isoUtc: null })
    }
    // created_at als Zeitstempel verwenden (UTC)
    const createdAt = new Date(row.created_at)
    const now = new Date()
    const diffMin = Math.floor((now.getTime() - createdAt.getTime()) / 60000)
    let ago = 'gerade eben'
    if (diffMin === 1) ago = 'vor 1 Min'
    else if (diffMin > 1) ago = `vor ${diffMin} Min`
    // ISO-String in UTC
    const isoUtc = createdAt.toISOString()
    return NextResponse.json({ time: createdAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), ago, iso: row.created_at, isoUtc })
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json({ error: error.message || 'Fehler beim Laden des letzten Updates.' }, { status: 500 })
  }
} 