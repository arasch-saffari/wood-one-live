import { NextResponse } from 'next/server'
import db from '@/lib/database'

export async function POST() {
  try {
    // Alle Daten löschen
    db.exec('DELETE FROM measurements; DELETE FROM weather; VACUUM;')
    
    // Tabellenstruktur sicherstellen mit der neuen Spalte
    db.exec(`
      CREATE TABLE IF NOT EXISTS measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        station TEXT NOT NULL,
        time TEXT NOT NULL,
        las REAL NOT NULL,
        source_file TEXT,
        datetime DATETIME,
        all_csv_fields TEXT,
        UNIQUE(station, time)
      );
      CREATE TABLE IF NOT EXISTS weather (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        station TEXT NOT NULL,
        time TEXT NOT NULL,
        windSpeed REAL,
        windDir TEXT,
        relHumidity REAL,
        temperature REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(station, time)
      );
    `)
    
    // Migration: Spalte all_csv_fields hinzufügen, falls sie fehlt
    try {
      const columns = db.prepare("PRAGMA table_info(measurements)").all() as Array<{ name: string }>
      const hasAllCsvFields = columns.some(col => col.name === 'all_csv_fields')
      if (!hasAllCsvFields) {
        db.exec('ALTER TABLE measurements ADD COLUMN all_csv_fields TEXT')
        console.log('✅ Spalte all_csv_fields hinzugefügt')
      }
    } catch {
      console.log('Spalte all_csv_fields existiert bereits oder konnte nicht hinzugefügt werden')
    }
    
    return NextResponse.json({ success: true, message: 'Alle Messwerte und Wetterdaten wurden gelöscht und die Tabellen neu aufgebaut.' })
  } catch (e: unknown) {
    const error = e as Error
    return NextResponse.json({ success: false, message: error?.message || 'Fehler beim Neuaufbau.', notify: true }, { status: 500 })
  }
} 