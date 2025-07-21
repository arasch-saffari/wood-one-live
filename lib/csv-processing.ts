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
      
      rows = rows.slice(1) // drop first row
      
      // Determine the correct column name for noise level based on station
      const noiseColumn = station === "heuballern" ? "LAF" : "LAS"
      
      // Validate and process rows
      const validRows = rows.filter(
        (row) =>
          row["Systemzeit "] &&
          row[noiseColumn] &&
          !isNaN(Number(row[noiseColumn].replace(",", ".")))
      )
      
      // Batch-Import: Verarbeite in Blöcken von 500 Zeilen
      const BATCH_SIZE = 500
      let insertedCount = 0
      for (let batchStart = 0; batchStart < validRows.length; batchStart += BATCH_SIZE) {
        const batch = validRows.slice(batchStart, batchStart + BATCH_SIZE)
        const blocks: { [block: string]: number[] } = {}
        const blockDatetimes: { [block: string]: string[] } = {}
        batch.forEach((row, idx) => {
          try {
            const sysTime = row["Systemzeit "]?.trim()
            const las = Number(row[noiseColumn].replace(",", "."))
            if (!sysTime || isNaN(las)) throw new Error('Ungültige Zeile')
            const [h, m] = sysTime.split(":")
            if (!h || !m) throw new Error('Ungültige Zeit')
            const blockTime = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`
            if (!blocks[blockTime]) blocks[blockTime] = []
            blocks[blockTime].push(las)
            // Datum bestimmen
            let dateStr = null
            if (row['Datum']) {
              // Versuche deutsches Datumsformat (z.B. 01.07.2024)
              const parts = row['Datum'].split('.')
              if (parts.length === 3) {
                dateStr = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
              }
            } else if (row['Date']) {
              // ISO oder anderes Format
              dateStr = row['Date']
            }
            if (!dateStr) {
              // Fallback: Änderungsdatum der Datei
              const mtime = fileStat.mtime
              dateStr = `${mtime.getFullYear()}-${String(mtime.getMonth()+1).padStart(2,'0')}-${String(mtime.getDate()).padStart(2,'0')}`
            }
            const datetime = `${dateStr} ${blockTime}:00`
            if (!blockDatetimes[blockTime]) blockDatetimes[blockTime] = []
            blockDatetimes[blockTime].push(datetime)
          } catch (err) {
            console.warn(`[Batch-Import] Fehlerhafte Zeile (Batch ${batchStart}, Index ${idx}):`, err)
          }
        })
        // Transaktion für den Batch
        db.exec('BEGIN TRANSACTION')
        try {
          const insertStmt = db.prepare(
            'INSERT OR IGNORE INTO measurements (station, time, las, source_file, datetime) VALUES (?, ?, ?, ?, ?)'
          )
          for (const [time, lasArr] of Object.entries(blocks)) {
            const las = Number((lasArr.reduce((a, b) => a + b, 0) / lasArr.length).toFixed(2))
            // Wähle das späteste datetime für diesen Block
            const datetimes = blockDatetimes[time] || []
            const datetime = datetimes.length > 0 ? datetimes.sort().reverse()[0] : null
            const result = insertStmt.run(station, time, las, path.basename(csvPath), datetime)
            if (result.changes > 0) insertedCount++
            // Wetterdaten synchronisieren (nur für neue Einträge und aktuelle Zeitblöcke)
            try {
              // Zeitblock in Date-Objekt umwandeln (heute, HH:MM)
              const now = new Date()
              const [h, m] = time.split(":").map(Number)
              const blockDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
              const diffMin = (now.getTime() - blockDate.getTime()) / (1000 * 60)
              // Nur wenn Zeitblock max. 10 Minuten in der Vergangenheit oder 5 Minuten in der Zukunft liegt
              if (diffMin >= -5 && diffMin <= 10) {
                const weather = getWeatherForBlock('global', time)
                if (!weather || isWeatherDataOld('global', time, 15)) {
                  fetchWeather().then(w => {
                    if (w) {
                      insertWeather('global', time, w.windSpeed ?? 0, w.windDir ?? '', w.relHumidity ?? 0, typeof w.temperature === 'number' ? w.temperature : undefined)
                      console.log(`  🌦️ Wetterdaten für ${time} aktualisiert.`)
                    }
                  }).catch(e => {
                    const msg = e instanceof Error ? e.message : String(e)
                    console.warn(`  ⚠️ Wetterdaten für ${time} konnten nicht aktualisiert werden:`, msg)
                  })
                }
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e)
              console.warn(`  ⚠️ Wetterdaten-Check für ${time} fehlgeschlagen:`, msg)
            }
          }
          db.exec('COMMIT')
        } catch (batchErr) {
          db.exec('ROLLBACK')
          console.error(`[Batch-Import] Fehler im Batch (Batch ${batchStart}):`, batchErr)
          continue // Nächster Batch
        }
        if (batch.length === BATCH_SIZE) {
          console.log(`[Batch-Import] ${batchStart + BATCH_SIZE} Zeilen verarbeitet...`)
        }
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