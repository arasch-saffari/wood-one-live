import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import db from './database'
// Wetter-Imports entfernt
// import { fetchWeather } from './weather'
// import { insertWeather } from './db-helpers'

// CSV Processing Functions
export async function processCSVFile(station: string, csvPath: string) {
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
        console.log(`📁 Datei ${fileName} bereits verarbeitet, überspringe...`)
        return 0
      }
      
      const csvContent = fs.readFileSync(csvPath, 'utf-8')
      console.log(`📄 CSV-Inhalt (erste 200 Zeichen): ${csvContent.substring(0, 200)}`)
      
      const parsed = Papa.parse(csvContent, {
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
      })
      
      console.log(`📊 Parsed CSV: ${parsed.data.length} Zeilen, Headers: ${Object.keys(parsed.data[0] || {}).join(', ')}`)
      
      const rows = parsed.data as Record<string, string>[]
      if (!Array.isArray(rows) || rows.length < 2) {
        console.log(`⚠️  Keine gültigen Daten in ${fileName}`)
        return 0
      }
      
      console.log(`📊 Verarbeite ${rows.length} Zeilen aus ${fileName} für Station ${station}`)
      
      // Erweiterte Validierung: Akzeptiere alle CSV-Felder dynamisch
      const validRows = rows.filter((row) => {
        let sysTime = row["Systemzeit "]?.trim()
        console.log(`🔍 Validiere Zeile mit Zeit: ${sysTime}`)
        
        // Dynamische Spaltenwahl: Alle verfügbaren Lärmspalten prüfen
        const noiseColumns = ["LAF", "LAS", "LAeq", "Lmax", "Lmin", "LAFT5s", "LAFTeq", "LAF5s", "LCFeq", "LCF5s"]
        let lasRaw: string | null = null
        let usedNoiseCol: string | null = null
        
        for (const col of noiseColumns) {
          if (row[col] && row[col].trim()) {
            lasRaw = row[col]
            usedNoiseCol = col
            console.log(`📊 Gefunden Lärmspalte: ${col} = ${lasRaw}`)
            break
          }
        }
        
        if (!sysTime || !lasRaw) {
          console.log(`⚠️  Zeile übersprungen: Keine Zeit (${sysTime}) oder Lärmdaten (${lasRaw})`)
          return false
        }
        
        // Zeitformat-Check: Akzeptiere auch HH:MM:SS:MS und extrahiere HH:MM:SS
        const timeParts = sysTime.split(":")
        if (timeParts.length < 3) {
          console.log(`⚠️  Ungültiges Zeitformat: ${sysTime}`)
          return false
        }
        
        // Extrahiere nur HH:MM:SS, ignoriere Millisekunden
        const hours = timeParts[0].padStart(2, "0")
        const minutes = timeParts[1].padStart(2, "0")
        const seconds = timeParts[2].padStart(2, "0")
        sysTime = `${hours}:${minutes}:${seconds}`
        console.log(`⏰ Normalisierte Zeit: ${sysTime}`)
        
        // Wertebereich-Check für Lärmdaten
        const las = Number(lasRaw.replace(",", "."))
        if (isNaN(las) || las <= 0 || las >= 150) {
          console.log(`⚠️  Ungültiger Lärmwert: ${lasRaw} -> ${las}`)
          return false
        }
        
        console.log(`✅ Zeile validiert: Zeit=${sysTime}, Lärm=${las} dB`)
        
        // Speichere das extrahierte HH:MM:SS zurück
        row["Systemzeit "] = sysTime
        // Speichere die verwendete Lärmspalte für später
        row["_usedNoiseCol"] = usedNoiseCol || ''
        row["_noiseValue"] = las.toString()
        
        // Alle CSV-Felder beibehalten (keine Filterung)
        console.log(`📋 Alle CSV-Felder: ${Object.keys(row).join(', ')}`)
        
        return true
      })
      
      console.log(`✅ ${validRows.length} gültige Zeilen gefunden`)
      
      // Jede Zeile als separaten Messwert speichern
      let insertedCount = 0
      
      db.exec('BEGIN TRANSACTION')
      try {
        const insertStmt = db.prepare(
          'INSERT OR IGNORE INTO measurements (station, time, las, source_file, datetime, all_csv_fields) VALUES (?, ?, ?, ?, ?, ?)' 
        )
        
        for (const row of validRows) {
          const sysTime = row["Systemzeit "]
          const las = Number(row["_noiseValue"])
          
          // Verbesserte Datum/Zeit-Verarbeitung
          let dateStr = null
          if (row['Datum']) {
            const parts = row['Datum'].split('.')
            if (parts.length === 3) {
              dateStr = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
            }
          } else if (row['Date']) {
            dateStr = row['Date']
          } else if (row['datetime']) {
            // Falls bereits ein vollständiger DateTime vorhanden ist
            const dt = new Date(row['datetime'])
            if (!isNaN(dt.getTime())) {
              dateStr = dt.toISOString().split('T')[0]
            }
          }
          
          if (!dateStr) {
            const mtime = fileStat.mtime
            dateStr = `${mtime.getFullYear()}-${String(mtime.getMonth()+1).padStart(2,'0')}-${String(mtime.getDate()).padStart(2,'0')}`
          }
          
          const datetime = `${dateStr} ${sysTime}`
          console.log(`📅 Datum: ${dateStr}, Zeit: ${sysTime}, DateTime: ${datetime}`)
          
          // Speichere auch den vollständigen DateTime in der CSV-Zeile
          row['_fullDateTime'] = datetime
          
          // Alle CSV-Felder als JSON speichern
          const allCsvFields = JSON.stringify(row)
          console.log(`💾 Speichere Messwert: Station=${station}, Zeit=${sysTime}, LAS=${las}`)
          
          // Retry-Logik für Insert in measurements
          let insertResult = null
          for (let attempt = 1; attempt <= 5; attempt++) {
            try {
              insertResult = insertStmt.run(station, sysTime, las, path.basename(csvPath), datetime, allCsvFields)
              break
            } catch (err: unknown) {
              if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'SQLITE_BUSY') {
                console.warn(`⚠️  DB locked (Insert measurements), Versuch ${attempt}/5, warte 200ms...`)
                await new Promise(res => setTimeout(res, 200))
                continue
              } else {
                throw err
              }
            }
          }
          const result = insertResult
          if (result && result.changes > 0) {
            insertedCount++
            console.log(`✅ Messwert erfolgreich gespeichert`)
            // Wetterdaten werden NICHT mehr im Import gespeichert!
          } else {
            console.log(`⚠️  Messwert nicht gespeichert (wahrscheinlich Duplikat)`)
          }
        }
        
        db.exec('COMMIT')
        console.log(`✅ ${insertedCount} Messwerte importiert`)
        
      } catch (batchErr) {
        db.exec('ROLLBACK')
        console.error('❌ Fehler beim Batch-Insert:', batchErr)
        throw batchErr
      }
      
      return insertedCount
    } catch (e) {
      if (attempts < MAX_ATTEMPTS) {
        console.log(`⚠️  Versuch ${attempts + 1}/${MAX_ATTEMPTS} fehlgeschlagen, wiederhole...`)
        continue
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`❌ Alle Versuche fehlgeschlagen für ${csvPath}:`, msg)
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
  const rows = parsed.data as Record<string, string>[]
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

export async function processAllCSVFiles() {
  const stations = ['ort', 'techno', 'heuballern', 'band']
  let totalInserted = 0
  
  console.log('🔍 Starte CSV-Verarbeitung für alle Stationen...')
  
  for (const station of stations) {
    const csvDir = path.join(process.cwd(), "public", "csv", station)
    console.log(`📁 Überprüfe Verzeichnis: ${csvDir}`)
    
    try {
      if (!fs.existsSync(csvDir)) {
        console.log(`⚠️  Verzeichnis existiert nicht: ${csvDir}`)
        continue
      }
      
      const csvFiles = fs.readdirSync(csvDir).filter(file => file.endsWith('.csv'))
      console.log(`📊 Gefunden: ${csvFiles.length} CSV-Dateien in ${station}`)
      
      for (const csvFile of csvFiles) {
        const csvPath = path.join(csvDir, csvFile)
        console.log(`🔄 Verarbeite: ${csvFile}`)
        
        try {
          const inserted = await processCSVFile(station, csvPath)
          console.log(`✅ ${inserted} Messwerte aus ${csvFile} importiert`)
          totalInserted += inserted
        } catch (fileError) {
          console.error(`❌ Fehler beim Verarbeiten von ${csvFile}:`, fileError)
        }
      }
    } catch (e) {
      console.error(`❌ Fehler beim Verarbeiten von ${station}:`, e)
    }
  }
  
  console.log(`📊 Insgesamt ${totalInserted} Messwerte importiert`)
  return totalInserted
}