import { NextResponse } from "next/server"
import db from "@/lib/database"

export async function GET() {
  try {
    console.log('🔄 Teste direkten Datenbank-Insert...')
    
    // Teste einfachen Insert
    const insertStmt = db.prepare(
      'INSERT OR IGNORE INTO measurements (station, time, las, source_file, datetime, all_csv_fields) VALUES (?, ?, ?, ?, ?, ?)' 
    )
    
    const result = insertStmt.run(
      'test', 
      '18:46:59', 
      38.8, 
      'test.csv', 
      '2025-07-21 18:46:59', 
      '{"test": "data"}'
    )
    
    console.log('📊 Insert-Ergebnis:', result)
    
    // Prüfe Anzahl der Messwerte
    const countResult = db.prepare('SELECT COUNT(*) as count FROM measurements').get() as { count: number }
    console.log('📊 Messwerte in DB:', countResult.count)
    
    return NextResponse.json({ 
      success: true, 
      insertResult: result,
      totalMeasurements: countResult.count
    })
  } catch (e) {
    console.error('❌ Fehler:', e)
    return NextResponse.json({ 
      success: false, 
      error: (e as Error).message 
    }, { status: 500 })
  }
} 