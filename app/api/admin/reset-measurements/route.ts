import { NextResponse } from 'next/server'
import db from '@/lib/db'
import fs from 'fs'
import path from 'path'
import { processAllCSVFiles } from '@/lib/csv-processing'

export async function POST() {
  try {
    // 1. Nur Messdaten aus der DB löschen (Wetterdaten bleiben)
    db.exec('DELETE FROM measurements;')
    
    // 2. Alle CSV-Dateien aus den Ordnern löschen
    const stations = ['ort', 'techno', 'heuballern', 'band']
    let deletedFiles = 0
    
    for (const station of stations) {
      const csvDir = path.join(process.cwd(), 'public', 'csv', station)
      if (fs.existsSync(csvDir)) {
        const files = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'))
        for (const file of files) {
          fs.unlinkSync(path.join(csvDir, file))
          deletedFiles++
        }
      }
    }

    // 3. CSVs neu einlesen (falls neue hochgeladen werden)
    const processedFiles = await processAllCSVFiles()

    return NextResponse.json({ 
      success: true, 
      message: `Messdaten zurückgesetzt. ${deletedFiles} CSV-Dateien gelöscht, ${processedFiles} Dateien neu eingelesen. Wetterdaten beibehalten.`,
      deletedFiles,
      processedFiles,
      weatherKept: true
    })
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Fehler beim Zurücksetzen der Messdaten.'
    return NextResponse.json({ success: false, message: error, notify: true }, { status: 500 })
  }
} 