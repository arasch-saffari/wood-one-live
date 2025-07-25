import { NextRequest } from 'next/server'
import db from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { id, value, type, field } = await req.json()
    if (!id || typeof value === 'undefined' || !type) return Response.json({ success: false, message: 'Fehlende Parameter' })
    if (type === 'measurement') {
      db.prepare('UPDATE measurements SET las = ? WHERE id = ?').run(value, id)
    } else if (type === 'weather') {
      // Erlaube gezielte Felder für Wetterdaten
      const allowedFields = ['windSpeed', 'windDir', 'relHumidity', 'temperature']
      if (!field || !allowedFields.includes(field)) {
        return Response.json({ success: false, message: 'Ungültiges Wetterdaten-Feld' })
      }
      // Sichere SQL-Query mit expliziter Feldauswahl
      const queries = {
        windSpeed: 'UPDATE weather SET windSpeed = ? WHERE id = ?',
        windDir: 'UPDATE weather SET windDir = ? WHERE id = ?',
        relHumidity: 'UPDATE weather SET relHumidity = ? WHERE id = ?',
        temperature: 'UPDATE weather SET temperature = ? WHERE id = ?'
      }
      db.prepare(queries[field as keyof typeof queries]).run(value, id)
    } else {
      return Response.json({ success: false, message: 'Unbekannter Typ' })
    }
    return Response.json({ success: true })
  } catch (e: unknown) {
    const error = e as Error
    return Response.json({ success: false, message: error.message || 'Fehler beim Speichern', notify: true })
  }
} 