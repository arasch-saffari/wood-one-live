import fs from 'fs'
import path from 'path'
import csvParser from 'csv-parser'
import db from './database'
import { importDuration } from '../app/api/metrics/route'
import { triggerDeltaUpdate } from '../app/api/updates/route'
// Wetter-Imports entfernt
// import { fetchWeather } from './weather'
// import { insertWeather } from './db-helpers'

// Hilfsfunktion: Lese/Schreibe Offset-Metadaten für eine CSV-Datei
function getMetaPath(csvPath: string) {
  return csvPath + '.meta.json'
}
function readMeta(csvPath: string): { lastLine: number } {
  const metaPath = getMetaPath(csvPath)
  if (fs.existsSync(metaPath)) {
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    } catch {
      return { lastLine: 0 }
    }
  }
  return { lastLine: 0 }
}
function writeMeta(csvPath: string, meta: { lastLine: number }) {
  const metaPath = getMetaPath(csvPath)
  fs.writeFileSync(metaPath, JSON.stringify(meta))
  // Crash-sicher: fsync
  const fd = fs.openSync(metaPath, 'r')
  fs.fsyncSync(fd)
  fs.closeSync(fd)
}

// Streaming-CSV-Verarbeitung mit inkrementellem Offset
export async function processCSVFile(station: string, csvPath: string) {
  let attempts = 0
  const MAX_ATTEMPTS = 3
  while (attempts < MAX_ATTEMPTS) {
    try {
      attempts++
      const startTime = Date.now()
      const fileStat = fs.statSync(csvPath)
      const fileName = path.basename(csvPath)
      // Entferne das Löschen aller alten Einträge für diese Datei/Station
      // Lese Offset/Zeilennummer
      const meta = readMeta(csvPath)
      const lastLine = meta.lastLine || 0
      let currentLine = 0
      let insertedCount = 0
      try {
        db.exec('BEGIN TRANSACTION')
        await new Promise<void>((resolve, reject) => {
          fs.createReadStream(csvPath)
            .pipe(csvParser({ separator: ';', skipLines: lastLine, mapHeaders: ({ header }) => header.trim() }))
            .on('data', (row) => {
              currentLine++
              // Zeilenzähler bezieht sich auf alle Zeilen inkl. Header
              const realLine = lastLine + currentLine
              try {
                // Validierung wie bisher
                let sysTime = row['Systemzeit']?.trim() || row['Systemzeit ']?.trim()
                const noiseColumns = ["LAF", "LAS", "LAeq", "Lmax", "Lmin", "LAFT5s", "LAFTeq", "LAF5s", "LCFeq", "LCF5s"]
                let lasRaw: string | null = null
                let usedNoiseCol: string | null = null
                for (const col of noiseColumns) {
                  if (row[col] && row[col].trim()) {
                    lasRaw = row[col]
                    usedNoiseCol = col
                    break
                  }
                }
                if (!sysTime || !lasRaw) return
                const timeParts = sysTime.split(":")
                if (timeParts.length < 3) return
                const hours = timeParts[0].padStart(2, "0")
                const minutes = timeParts[1].padStart(2, "0")
                const seconds = timeParts[2].padStart(2, "0")
                sysTime = `${hours}:${minutes}:${seconds}`
                const las = Number(lasRaw.replace(",", "."))
                if (isNaN(las)) return
                row['Systemzeit'] = sysTime
                row['_usedNoiseCol'] = usedNoiseCol || ''
                row['_noiseValue'] = las.toString()
                // Datum bestimmen
                let dateStr = null
                if (row['Datum']) {
                  const parts = row['Datum'].split('.')
                  if (parts.length === 3) {
                    dateStr = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
                  }
                } else if (row['Date']) {
                  dateStr = row['Date']
                } else if (row['datetime']) {
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
                row['_fullDateTime'] = datetime
                const allCsvFields = JSON.stringify(row)
                const time = datetime
                let insertResult = null
                for (let attempt = 1; attempt <= 5; attempt++) {
                  try {
                    insertResult = db.prepare(
                      'INSERT OR IGNORE INTO measurements (station, time, las, source_file, datetime, all_csv_fields) VALUES (?, ?, ?, ?, ?, ?)'
                    ).run(station, time, las, fileName, datetime, allCsvFields)
                    break
                  } catch (err: unknown) {
                    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'SQLITE_BUSY') {
                      console.warn(`⚠️  DB locked (Insert measurements), Versuch ${attempt}/5, warte 200ms...`)
                      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200)
                      continue
                    } else {
                      throw err
                    }
                  }
                }
                if (insertResult && insertResult.changes > 0) {
                  insertedCount++
                }
                // Nach jeder Zeile Offset speichern
                writeMeta(csvPath, { lastLine: realLine })
              } catch (err) {
                console.error(`❌ Fehler in Zeile ${lastLine + currentLine}:`, err)
              }
            })
            .on('end', () => {
                try {
                  db.exec('COMMIT')
                } catch (e: unknown) {
                  const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : String(e)
                  if (!msg.includes('no transaction is active')) {
                    console.error('COMMIT-Fehler:', e)
                  }
                }
                resolve()
            })
            .on('error', (err) => {
                try {
                  db.exec('ROLLBACK')
                } catch (e: unknown) {
                  const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : String(e)
                  if (!msg.includes('no transaction is active')) {
                    console.error('ROLLBACK-Fehler:', e)
                  }
                }
                reject(err)
            })
        })
      } catch (batchErr) {
        db.exec('ROLLBACK')
        throw batchErr
      }
      // Nach erfolgreichem Import: File-Cache für diese Station löschen
      const cacheFile = path.join(process.cwd(), 'cache', `stationdata-${station}.json`)
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile)
      }
      const durationSec = (Date.now() - startTime) / 1000
      importDuration.set(durationSec)
      if (insertedCount > 0) {
        triggerDeltaUpdate()
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

export async function processAllCSVFiles() {
  const stations = ['ort', 'techno', 'heuballern', 'band']
  let totalInserted = 0

  console.log('🔍 Starte CSV-Verarbeitung für alle Stationen...')

  // Stationen parallel verarbeiten
  const stationResults = await Promise.all(stations.map(async (station) => {
    const csvDir = path.join(process.cwd(), "public", "csv", station)
    console.log(`📁 Überprüfe Verzeichnis: ${csvDir}`)

    try {
      if (!fs.existsSync(csvDir)) {
        console.log(`⚠️  Verzeichnis existiert nicht: ${csvDir}`)
        return 0
      }

      const csvFiles = fs.readdirSync(csvDir).filter(file => file.endsWith('.csv'))
      console.log(`📊 Gefunden: ${csvFiles.length} CSV-Dateien in ${station}`)

      // Dateien strikt seriell verarbeiten
      let stationSum = 0
      for (const csvFile of csvFiles) {
        const csvPath = path.join(csvDir, csvFile)
        console.log(`🔄 Verarbeite: ${csvFile}`)
        try {
          const inserted = await processCSVFile(station, csvPath)
          console.log(`✅ ${inserted} Messwerte aus ${csvFile} importiert`)
          stationSum += inserted
        } catch (fileError) {
          console.error(`❌ Fehler beim Verarbeiten von ${csvFile}:`, fileError)
        }
      }
      return stationSum
    } catch (e) {
      console.error(`❌ Fehler beim Verarbeiten von ${station}:`, e)
      return 0
    }
  }))

  totalInserted = stationResults.reduce((a, b) => a + b, 0)
  console.log(`📊 Insgesamt ${totalInserted} Messwerte importiert`)
  return totalInserted
}

if (require.main === module) {
  processAllCSVFiles().then(count => {
    console.log(`CSV-Import abgeschlossen. Gesamt: ${count}`)
    process.exit(0)
  }).catch(e => {
    console.error('Fehler beim CSV-Import:', e)
    process.exit(1)
  })
}