import { NextResponse } from "next/server"
import { processCSVFile } from "@/lib/csv-processing"

export async function GET() {
  try {
    const csvPath = "/Users/araschsaffari/code/cursor/wood-one-live/public/csv/ort/test.csv"
    console.log('🔄 Teste einzelne CSV-Datei:', csvPath)
    
    const result = await processCSVFile('ort', csvPath)
    console.log('✅ Ergebnis:', result)
    
    return NextResponse.json({ 
      success: true, 
      result,
      csvPath
    })
  } catch (e) {
    console.error('❌ Fehler:', e)
    return NextResponse.json({ 
      success: false, 
      error: (e as Error).message 
    }, { status: 500 })
  }
} 