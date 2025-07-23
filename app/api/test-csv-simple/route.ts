import { NextResponse } from "next/server"
import fs from 'fs'
import Papa from 'papaparse'

export async function GET() {
  try {
    const csvPath = "/Users/araschsaffari/code/cursor/wood-one-live/public/csv/ort/test.csv"
    console.log('🔄 Teste einfache CSV-Verarbeitung:', csvPath)
    
    // Prüfe ob Datei existiert
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Datei existiert nicht' 
      }, { status: 404 })
    }
    
    // Lese CSV-Inhalt
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    console.log('📄 CSV-Inhalt gelesen, Länge:', csvContent.length)
    
    // Parse CSV
    const parsed = Papa.parse(csvContent, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
    })
    
    console.log('📊 Parsed CSV:', parsed.data.length, 'Zeilen')
    console.log('📋 Headers:', Object.keys(parsed.data[0] || {}))
    
    const rows = parsed.data as Record<string, string>[]
    if (rows.length > 0) {
      console.log('🔍 Erste Zeile:', rows[0])
    }
    
    return NextResponse.json({ 
      success: true, 
      fileExists: true,
      csvLength: csvContent.length,
      rowCount: rows.length,
      headers: Object.keys(rows[0] || {}),
      firstRow: rows[0] || null
    })
  } catch (e) {
    console.error('❌ Fehler:', e)
    return NextResponse.json({ 
      success: false, 
      error: (e as Error).message 
    }, { status: 500 })
  }
} 