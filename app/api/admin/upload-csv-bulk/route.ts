import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { processCSVFile } from '@/lib/csv-processing'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const station = formData.get('station') as string
    
    if (!files || files.length === 0 || !station) {
      return NextResponse.json({ 
        success: false, 
        message: 'Dateien oder Station fehlt.' 
      }, { status: 400 })
    }

    // Validiere Station
    const validStations = ['ort', 'techno', 'heuballern', 'band']
    if (!validStations.includes(station)) {
      return NextResponse.json({ 
        success: false, 
        message: `Ungültige Station. Erlaubt: ${validStations.join(', ')}` 
      }, { status: 400 })
    }

    // Erstelle Verzeichnis falls nicht vorhanden
    const uploadDir = path.join(process.cwd(), 'public', 'csv', station)
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    let totalInserted = 0
    const results = []

    for (const file of files) {
      if (!file.name.endsWith('.csv')) {
        results.push({
          file: file.name,
          success: false,
          message: 'Nur CSV-Dateien erlaubt.'
        })
        continue
      }

      try {
        // Datei speichern
        const filePath = path.join(uploadDir, file.name)
        const arrayBuffer = await file.arrayBuffer()
        fs.writeFileSync(filePath, Buffer.from(arrayBuffer))

        // Sofort verarbeiten
        const inserted = await processCSVFile(station, filePath)
        totalInserted += inserted

        results.push({
          file: file.name,
          success: true,
          inserted,
          message: `${inserted} Messwerte importiert`
        })

      } catch (error) {
        results.push({
          file: file.name,
          success: false,
          message: error instanceof Error ? error.message : 'Unbekannter Fehler'
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Bulk-Upload abgeschlossen. ${totalInserted} Messwerte insgesamt importiert.`,
      totalInserted,
      results
    })

  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Fehler beim Bulk-Upload.'
    return NextResponse.json({ 
      success: false, 
      message: error 
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const stations = ['ort', 'techno', 'heuballern', 'band']
    const status: Record<string, any> = {}
    
    for (const station of stations) {
      const csvDir = path.join(process.cwd(), 'public', 'csv', station)
      const exists = fs.existsSync(csvDir)
      const files = exists ? fs.readdirSync(csvDir).filter(f => f.endsWith('.csv')) : []
      
      status[station] = {
        exists,
        fileCount: files.length,
        files: files.slice(0, 10) // Erste 10 Dateien
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      status,
      message: 'CSV-Verzeichnis-Status abgerufen'
    })
  } catch (e) {
    return NextResponse.json({ 
      success: false, 
      error: (e as Error).message 
    }, { status: 500 })
  }
} 