import { NextResponse } from 'next/server'
import db from '@/lib/database'

export async function POST() {
  try {
    console.log('🗑️  Leere Datenbank...')
    
    // Alle Messwerte löschen
    const measurementsDeleted = db.prepare('DELETE FROM measurements').run()
    console.log(`📊 ${measurementsDeleted.changes} Messwerte gelöscht`)
    
    // Alle Wetterdaten löschen
    const weatherDeleted = db.prepare('DELETE FROM weather').run()
    console.log(`🌤️  ${weatherDeleted.changes} Wetterdaten gelöscht`)
    
    // Schwellenwerte und Audit-Logs beibehalten (Konfiguration)
    
    console.log('✅ Datenbank erfolgreich geleert')
    
    return NextResponse.json({ 
      success: true, 
      message: `Datenbank geleert: ${measurementsDeleted.changes} Messwerte, ${weatherDeleted.changes} Wetterdaten gelöscht`,
      deletedMeasurements: measurementsDeleted.changes,
      deletedWeather: weatherDeleted.changes
    })
  } catch (e: unknown) {
    console.error('❌ Fehler beim Leeren der Datenbank:', e)
    return NextResponse.json({ 
      success: false, 
      message: e instanceof Error ? e.message : 'Fehler beim Leeren der Datenbank.',
      notify: true
    }, { status: 500 })
  }
} 