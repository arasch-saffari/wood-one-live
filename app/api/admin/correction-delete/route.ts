import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { id, type } = await req.json()
    if (!id || !type) return Response.json({ success: false, message: 'Fehlende Parameter' })
    if (type === 'measurement') {
      db.prepare('DELETE FROM measurements WHERE id = ?').run(id)
    } else if (type === 'weather') {
      db.prepare('DELETE FROM weather WHERE id = ?').run(id)
    } else {
      return Response.json({ success: false, message: 'Unbekannter Typ' })
    }
    return Response.json({ success: true })
  } catch (e: any) {
    return Response.json({ success: false, message: e?.message || 'Fehler beim Löschen', notify: true })
  }
} 