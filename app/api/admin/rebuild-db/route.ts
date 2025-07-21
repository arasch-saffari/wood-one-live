import { NextResponse } from 'next/server'
import db from '@/lib/database'

export async function POST() {
  try {
    // Alle Daten löschen
    db.exec('DELETE FROM measurements; DELETE FROM weather; VACUUM;')
    // Tabellenstruktur sicherstellen (optional, falls Migrationen nötig)
    db.exec(`
      CREATE TABLE IF NOT EXISTS measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        station TEXT NOT NULL,
        time TEXT NOT NULL,
        las REAL NOT NULL,
        source_file TEXT,
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
    return NextResponse.json({ success: true, message: 'Alle Messwerte und Wetterdaten wurden gelöscht und die Tabellen neu aufgebaut.' })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Fehler beim Neuaufbau.' }, { status: 500 })
  }
} 