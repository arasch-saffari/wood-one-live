import { NextRequest } from 'next/server'
import db from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const station = searchParams.get('station') || 'ort'
  const type = searchParams.get('type') || 'measurement'
  const q = searchParams.get('q') || ''
  interface MeasurementRow {
    id: number
    datetime: string
    value: number
    time: string
  }

  interface WeatherRow {
    id: number
    datetime: string
    value: number | null
    time: string
  }

  let rows: (MeasurementRow | WeatherRow)[] = []
  try {
    if (type === 'measurement') {
      let sql = 'SELECT id, datetime, las AS value, time FROM measurements WHERE station = ?'
      const params: (string | number)[] = [station]
      if (q) {
        sql += ' AND (time LIKE ? OR las LIKE ? OR id LIKE ? OR datetime LIKE ?)' 
        params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
      }
      sql += ' ORDER BY datetime DESC LIMIT 100'
      rows = db.prepare(sql).all(...params)
    } else if (type === 'weather') {
      let sql = 'SELECT id, datetime, value, time FROM weather WHERE station = ?'
      const params: (string | number)[] = [station]
      if (q) {
        sql += ' AND (time LIKE ? OR value LIKE ? OR id LIKE ? OR datetime LIKE ?)' 
        params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
      }
      sql += ' ORDER BY datetime DESC LIMIT 100'
      rows = db.prepare(sql).all(...params)
    }
    return Response.json(rows)
  } catch (e: unknown) {
    if (e instanceof Error) {
      return Response.json({ error: e.message }, { status: 500 })
    }
    return Response.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
} 