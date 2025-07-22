// scripts/run-migrations.ts
import { logError } from '../lib/logger'
import db from '../lib/database'

// Tabellenstruktur sicherstellen
// measurements
// weather

db.exec(`
  DROP TABLE IF EXISTS measurements;
  CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    maxSPLAFast REAL NOT NULL,
    UNIQUE(station, date, time)
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