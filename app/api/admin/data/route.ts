import { NextResponse } from 'next/server'
import db from '@/lib/database'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'measurements'
    const station = searchParams.get('station')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    let rows: unknown[] = []
    if (type === 'measurements') {
      let sql = 'SELECT * FROM measurements'
      const params: unknown[] = []
      if (station) { sql += ' WHERE station = ?'; params.push(station) }
      sql += ' ORDER BY id DESC LIMIT ?'; params.push(limit)
      rows = db.prepare(sql).all(...params)
    } else if (type === 'weather') {
      let sql = 'SELECT * FROM weather'
      const params: unknown[] = []
      if (station) { sql += ' WHERE station = ?'; params.push(station) }
      sql += ' ORDER BY id DESC LIMIT ?'; params.push(limit)
      rows = db.prepare(sql).all(...params)
    }
    return NextResponse.json({ rows })
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json({ rows: [], error: error.message || 'Fehler bei der Suche.' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'measurements'
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, message: 'ID fehlt.' }, { status: 400 })
    let sql = ''
    if (type === 'measurements') sql = 'DELETE FROM measurements WHERE id = ?'
    else if (type === 'weather') sql = 'DELETE FROM weather WHERE id = ?'
    else return NextResponse.json({ success: false, message: 'Ungültiger Typ.' }, { status: 400 })
    db.prepare(sql).run(id)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json({ success: false, message: error.message || 'Fehler beim Löschen.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'measurements'
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, message: 'ID fehlt.' }, { status: 400 })
    const data = await req.json()
    let sql = ''
    let params: unknown[] = []
    if (type === 'measurements') {
      sql = 'UPDATE measurements SET station = ?, time = ?, las = ? WHERE id = ?'
      params = [data.station, data.time, data.las, id]
    } else if (type === 'weather') {
      sql = 'UPDATE weather SET station = ?, time = ?, windSpeed = ?, windDir = ?, relHumidity = ?, temperature = ? WHERE id = ?'
      params = [data.station, data.time, data.windSpeed, data.windDir, data.relHumidity, data.temperature, id]
    } else return NextResponse.json({ success: false, message: 'Ungültiger Typ.' }, { status: 400 })
    db.prepare(sql).run(...params)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json({ success: false, message: error.message || 'Fehler beim Bearbeiten.' }, { status: 500 })
  }
} 