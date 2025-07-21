import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { id, value, type } = await req.json()
    if (!id || typeof value === 'undefined' || !type) return Response.json({ success: false, message: 'Fehlende Parameter' })
    if (type === 'measurement') {
      db.prepare('UPDATE measurements SET las = ? WHERE id = ?').run(value, id)
    } else if (type === 'weather') {
      db.prepare('UPDATE weather SET value = ? WHERE id = ?').run(value, id)
    } else {
      return Response.json({ success: false, message: 'Unbekannter Typ' })
    }
    return Response.json({ success: true })
  } catch (e: any) {
    return Response.json({ success: false, message: e?.message || 'Fehler beim Speichern', notify: true })
  }
} 