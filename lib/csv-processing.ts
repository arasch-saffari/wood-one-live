import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import db from './database'
import { fetchWeather } from './weather'
import { insertWeather, getWeatherForBlock, isWeatherDataOld } from './db-helpers'

// CSV Processing Functions
export function processCSVFile(station: string, csvPath: string) {
  let attempts = 0
  const MAX_ATTEMPTS = 3
  while (attempts < MAX_ATTEMPTS) {
    try {
      attempts++
      // Check if file was already processed by checking file modification time
      const fileStat = fs.statSync(csvPath)
      const fileName = path.basename(csvPath)
      
      // Check if we already processed this file
      const processedCheck = db.prepare(
        'SELECT COUNT(*) as count FROM measurements WHERE station = ? AND source_file = ?'
      ).get(station, fileName) as { count: number }
      
      if (processedCheck.count > 0) {
        console.log(`  ⏭️  ${fileName}: Already processed, skipping`)
        return 0
      }
      
      const csvContent = fs.readFileSync(csvPath, 'utf-8')
      const parsed = Papa.parse(csvContent, {
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
      })
      
      let rows = parsed.data as Record<string, string>[]
      if (!Array.isArray(rows) || rows.length < 2) return 0
      
      // Flexible: Akzeptiere sowohl LAS als auch LAF für alle Stationen
      // Bestimme die Lärmspalte pro Zeile
      const validRows = rows.filter(
        (row) => {
          let sysTime = row["Systemzeit "]?.trim()
          // Flexible Spaltenwahl: LAF bevorzugt, sonst LAS
          const lasRaw = row["LAF"] ?? row["LAS"]
          if (!sysTime || !lasRaw) return false
          // Zeitformat-Check: Akzeptiere auch HH:MM:SS:MS und extrahiere HH:MM:SS
          const timeParts = sysTime.split(":")
          if (timeParts.length < 3) return false
          sysTime = `${timeParts[0].padStart(2, "0")}:${timeParts[1].padStart(2, "0")}:${timeParts[2].padStart(2, "0")}`
          // Wertebereich-Check
          const las = Number(lasRaw.replace(",", "."))
          if (isNaN(las) || las <= 0 || las >= 150) return false
          // Speichere das extrahierte HH:MM:SS zurück
          row["Systemzeit "] = sysTime
          // Speichere die verwendete Lärmspalte für später
          row["_usedNoiseCol"] = row["LAF"] !== undefined ? "LAF" : "LAS"
          return true
        }
      )
      // Jede Zeile als separaten Messwert speichern
      let insertedCount = 0
      db.exec('BEGIN TRANSACTION')
      try {
        const insertStmt = db.prepare(
          'INSERT OR IGNORE INTO measurements (station, time, las, source_file, datetime) VALUES (?, ?, ?, ?, ?)' 
        )
        for (const row of validRows) {
          const sysTime = row["Systemzeit "]
          // Nutze die tatsächlich verwendete Spalte
          const las = Number(row[row["_usedNoiseCol"]].replace(",", "."))
          // Datum bestimmen
          let dateStr = null
          if (row['Datum']) {
            const parts = row['Datum'].split('.')
            if (parts.length === 3) {
              dateStr = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
            }
          } else if (row['Date']) {
            dateStr = row['Date']
          }
          if (!dateStr) {
            const mtime = fileStat.mtime
            dateStr = `${mtime.getFullYear()}-${String(mtime.getMonth()+1).padStart(2,'0')}-${String(mtime.getDate()).padStart(2,'0')}`
          }
          const datetime = `${dateStr} ${sysTime}`
          const result = insertStmt.run(station, sysTime, las, path.basename(csvPath), datetime)
          if (result.changes > 0) insertedCount++
        }
        db.exec('COMMIT')
      } catch (batchErr) {
        db.exec('ROLLBACK')
        console.error(`[Import] Fehler beim Einfügen der Zeilen:`, batchErr)
      }
      return insertedCount
    } catch (e) {
      if (attempts < MAX_ATTEMPTS) {
        console.warn(`[Batch-Import] Fehler beim Import von ${csvPath}, Versuch ${attempts}:`, e)
        // Kurze Pause vor Retry
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200)
        continue
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[Batch-Import] Fehler beim Import von ${csvPath} nach ${MAX_ATTEMPTS} Versuchen:`, msg)
        return 0
      }
    }
  }
  return 0
}

export function parseCSVData(csvContent: string, station: string) {
  const parsed = Papa.parse(csvContent, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
  })
  let rows = parsed.data as Record<string, string>[]
  if (!Array.isArray(rows) || rows.length < 1) return []
  const noiseColumn = station === "heuballern" ? "LAF" : "LAS"
  const validRows = rows.filter(
    (row) =>
      row["Systemzeit "] &&
      row[noiseColumn] &&
      !isNaN(Number(row[noiseColumn].replace(",", ".")))
  )
  return validRows.map(row => ({
    time: row["Systemzeit "]?.trim(),
    las: Number(row[noiseColumn].replace(",", ".")),
  }))
}

export function processAllCSVFiles() {
  console.log('🔄 Processing all CSV files...')
  
  const stations = ['ort', 'techno', 'heuballern', 'band']
  let totalInserted = 0
  
  for (const station of stations) {
    const csvDir = path.join(process.cwd(), "public", "csv", station)
    
    try {
      if (!fs.existsSync(csvDir)) {
        console.log(`⚠️  CSV directory not found for ${station}`)
        continue
      }
      const csvFiles = fs.readdirSync(csvDir).filter(file => file.endsWith('.csv'))
      for (const csvFile of csvFiles) {
        const csvPath = path.join(csvDir, csvFile)
        const inserted = processCSVFile(station, csvPath)
        totalInserted += inserted
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[processAllCSVFiles] Fehler beim Verarbeiten von ${station}:`, msg)
    }
  }
  console.log(`✅ Total inserted: ${totalInserted}`)
}