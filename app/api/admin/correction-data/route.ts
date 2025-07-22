import db from '@/lib/db'
import { NextResponse } from 'next/server'

// Typdefinition für CorrectionData
interface CorrectionData {
  id: number;
  datetime: string;
  value: number;
  time: string;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const station = searchParams.get('station') || 'ort'
    const type = searchParams.get('type') || 'measurement'
    const q = searchParams.get('q') || ''
    let rows: CorrectionData[] = []
    if (type === 'measurement') {
      let sql = 'SELECT id, datetime, las AS value, time FROM measurements WHERE station = ?'
      const params: any[] = [station]
      if (q) {
        sql += ' AND (time LIKE ? OR las LIKE ? OR id LIKE ? OR datetime LIKE ?)' 
        params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
      }
      sql += ' ORDER BY datetime DESC LIMIT 100'
      rows = db.prepare(sql).all(...params) as CorrectionData[];
    } else if (type === 'weather') {
      let sql = 'SELECT id, datetime, value, time FROM weather WHERE station = ?'
      const params: any[] = [station]
      if (q) {
        sql += ' AND (time LIKE ? OR value LIKE ? OR id LIKE ? OR datetime LIKE ?)' 
        params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
      }
      sql += ' ORDER BY datetime DESC LIMIT 100'
      rows = db.prepare(sql).all(...params) as CorrectionData[];
    }
    return NextResponse.json(rows)
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json({ error: error.message || 'Fehler beim Laden der Daten.' }, { status: 500 })
  }
} 