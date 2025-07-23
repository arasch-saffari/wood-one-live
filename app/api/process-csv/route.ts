import { NextResponse } from "next/server"
import { processAllCSVFiles } from "@/lib/csv-processing"

export async function POST() {
  try {
    console.log('🔄 Starte direkte CSV-Verarbeitung...')
    const result = await processAllCSVFiles()
    console.log('✅ CSV-Verarbeitung abgeschlossen')
    
    return NextResponse.json({ 
      success: true, 
      message: `CSV processing completed successfully`,
      processedFiles: result
    })
  } catch (e) {
    console.error('❌ Fehler bei CSV-Verarbeitung:', e)
    return NextResponse.json({ 
      success: false, 
      error: (e as Error).message,
      notify: true
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    console.log('🔄 Starte direkte CSV-Verarbeitung (GET)...')
    const result = await processAllCSVFiles()
    console.log('✅ CSV-Verarbeitung abgeschlossen')
    
    return NextResponse.json({ 
      success: true, 
      message: `CSV processing completed successfully`,
      processedFiles: result
    })
  } catch (e) {
    console.error('❌ Fehler bei CSV-Verarbeitung:', e)
    return NextResponse.json({ 
      success: false, 
      error: (e as Error).message 
    }, { status: 500 })
  }
} 