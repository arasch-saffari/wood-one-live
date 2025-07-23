import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { processCSVFile } from '@/lib/csv-processing'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const station = formData.get('station') as string | null
    if (!file || !station) {
      return NextResponse.json({ success: false, message: 'Datei oder Station fehlt.' }, { status: 400 })
    }
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ success: false, message: 'Nur CSV-Dateien erlaubt.' }, { status: 400 })
    }
    // Zielpfad
    const uploadDir = path.join(process.cwd(), 'public', 'csv', station)
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
    const filePath = path.join(uploadDir, file.name)
    // Datei speichern
    const arrayBuffer = await file.arrayBuffer()
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer))
    // Sofort verarbeiten (async/await!)
    const imported = await processCSVFile(station, filePath)
    return NextResponse.json({ success: true, message: `${file.name} erfolgreich hochgeladen und verarbeitet. (${imported} Messwerte importiert)` })
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Fehler beim Upload.'
    return NextResponse.json({ success: false, message: error }, { status: 500 })
  }
} 