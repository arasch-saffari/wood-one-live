import { NextRequest } from 'next/server'
import db from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const station = searchParams.get('station') || 'ort'
  const type = searchParams.get('type') || 'measurement'
  let count = 0
  let lastModified = null
  if (type === 'measurement') {
    const row = db.prepare("SELECT COUNT(*) as count, MAX(date || ' ' || time) as lastModified FROM measurements WHERE station = ?").get(station) as { count: number, lastModified: string | null } | undefined
    count = row?.count ?? 0
    lastModified = row?.lastModified ?? null
  } else if (type === 'weather') {
    const row = db.prepare('SELECT COUNT(*) as count, MAX(datetime) as lastModified FROM weather WHERE station = ?').get(station) as { count: number, lastModified: string | null } | undefined
    count = row?.count ?? 0
    lastModified = row?.lastModified ?? null
  }
  return Response.json({ count, lastModified })
} 