import { NextResponse } from "next/server";
import db from '@/lib/database';
import { parseISO, format } from 'date-fns';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const station = searchParams.get('station')
    if (!station) return NextResponse.json({ error: 'Missing station parameter' }, { status: 400 })
    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.max(1, Math.min(500, parseInt(searchParams.get('pageSize') || '100', 10)))
    // Zeitraum-Filter
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    let from: string | undefined, to: string | undefined
    if (fromParam) from = format(parseISO(fromParam), 'yyyy-MM-dd')
    if (toParam) to = format(parseISO(toParam), 'yyyy-MM-dd')
    // Sortierung
    const sort = searchParams.get('sort') || 'date'
    const order = (searchParams.get('order') || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    // Count total
    let countQuery = 'SELECT COUNT(*) as total FROM measurements WHERE station = ?'
    let params: unknown[] = [station]
    if (from && to) {
      countQuery += ' AND date >= ? AND date <= ?'
      params.push(from, to)
    } else if (from) {
      countQuery += ' AND date >= ?'
      params.push(from)
    } else if (to) {
      countQuery += ' AND date <= ?'
      params.push(to)
    }
    const total = db.prepare(countQuery).get(...params).total as number
    // Daten abfragen
    let dataQuery = 'SELECT station, date, time, maxSPLAFast FROM measurements WHERE station = ?'
    params = [station]
    if (from && to) {
      dataQuery += ' AND date >= ? AND date <= ?'
      params.push(from, to)
    } else if (from) {
      dataQuery += ' AND date >= ?'
      params.push(from)
    } else if (to) {
      dataQuery += ' AND date <= ?'
      params.push(to)
    }
    dataQuery += ` ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`
    params.push(pageSize, (page - 1) * pageSize)
    const data = db.prepare(dataQuery).all(...params)
    return NextResponse.json({
      data,
      meta: { total, page, pageSize },
      error: null
    })
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json({ data: [], meta: { total: 0, page: 1, pageSize: 100 }, error: error.message }, { status: 500 })
  }
} 