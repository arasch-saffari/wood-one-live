import { NextResponse } from 'next/server'
import db from '@/lib/db'
import fs from 'fs'
import path from 'path'
import { processAllCSVFiles } from '@/lib/csv-processing'
import { fetchWeather } from '@/lib/weather'

export async function POST() {
  try {
    // 1. Alle Daten aus der DB löschen
    db.exec('DELETE FROM measurements;')
    db.exec('DELETE FROM weather;')

    // 2. Alle CSV-Dateien aus den Ordnern löschen
    const stations = ['ort', 'techno', 'heuballern', 'band']
    for (const station of stations) {
      const csvDir = path.join(process.cwd(), 'public', 'csv', station)
      if (fs.existsSync(csvDir)) {
        const files = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'))
        for (const file of files) {
          fs.unlinkSync(path.join(csvDir, file))
        }
      }
    }

    // 3. Wetterdaten neu abfragen (einmalig)
    await fetchWeather()

    // 4. CSVs neu einlesen (es sind jetzt keine mehr da, aber falls neue hochgeladen werden)
    processAllCSVFiles()

    return NextResponse.json({ success: true, message: 'Alle Daten gelöscht, Wetterdaten neu abgefragt, CSVs neu eingelesen.' })
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Fehler beim Zurücksetzen.'
    return NextResponse.json({ success: false, message: error, notify: true }, { status: 500 })
  }
} 