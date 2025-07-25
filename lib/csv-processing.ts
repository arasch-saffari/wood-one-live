import fs from 'fs'
import path from 'path'
import csvParser from 'csv-parser'
import db from './database'
import { importDuration } from '../app/api/metrics/route'
import { triggerDeltaUpdate, setCSVProcessingState } from '@/app/api/updates/route'
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
}

function writeMetaSync(csvPath: string, meta: { lastLine: number }) {
  const metaPath = getMetaPath(csvPath)
  fs.writeFileSync(metaPath, JSON.stringify(meta))
  // Crash-sicher: fsync nur bei explizitem Sync
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
      let batchCount = 0
      const BATCH_SIZE = 100 // Batch-Größe für Meta-Updates
      
      try {
        db.exec('BEGIN TRANSACTION')
        await new Promise<void>((resolve, reject) => {
          fs.createReadStream(csvPath)
            .pipe(csvParser({ separator: ';', skipLines: lastLine, mapHeaders: ({ header }) => header.trim() }))
            .on('data', (row) => {
              currentLine++
              batchCount++
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
                    // Verwende INSERT OR REPLACE statt INSERT OR IGNORE um Datenlücken zu vermeiden
                    insertResult = db.prepare(
                      'INSERT OR REPLACE INTO measurements (station, time, las, source_file, datetime, all_csv_fields) VALUES (?, ?, ?, ?, ?, ?)'
                    ).run(station, time, las, fileName, datetime, allCsvFields)
                    break
                  } catch (err: unknown) {
                    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'SQLITE_BUSY') {
                      if (process.env.NODE_ENV === 'development') {
                        console.warn(`⚠️  DB locked (Insert measurements), Versuch ${attempt}/5, warte 200ms...`)
                      }
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
                
                // Batch-Offset-Persistenz: Nur alle BATCH_SIZE Zeilen speichern
                if (batchCount >= BATCH_SIZE) {
                  writeMeta(csvPath, { lastLine: realLine })
                  batchCount = 0
                }
              } catch (err) {
                console.error(`❌ Fehler in Zeile ${lastLine + currentLine}:`, err)
              }
            })
            .on('end', () => {
                try {
                  db.exec('COMMIT')
                  // Finales Meta-Update mit fsync für Crash-Sicherheit
                  if (currentLine > 0) {
                    writeMetaSync(csvPath, { lastLine: lastLine + currentLine })
                  }
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
        // Rate limit SSE updates to prevent controller errors
        // Nur SSE-Updates senden wenn mehr als 500 Zeilen importiert wurden (erhöht von 100)
        if (insertedCount > 500) {
          setTimeout(() => {
            triggerDeltaUpdate()
          }, Math.random() * 3000 + 2000) // Random delay 2000-5000ms für große Imports (erhöht)
        }
        
        // Trigger 15-Min-Aggregation nach erfolgreichem Import
        try {
          const { update15MinAggregates } = await import('./db')
          await update15MinAggregates()
          if (process.env.NODE_ENV === 'development') {
            console.log(`📊 15-Min-Aggregation nach Import von ${insertedCount} Messwerten aktualisiert`)
          }
        } catch (aggError) {
          console.error('❌ Fehler bei 15-Min-Aggregation nach Import:', aggError)
        }
      }
      
      return insertedCount
    } catch (e) {
      if (attempts < MAX_ATTEMPTS) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚠️  Versuch ${attempts + 1}/${MAX_ATTEMPTS} fehlgeschlagen, wiederhole...`)
        }
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

export async function processAllCSVFiles(): Promise<number> {
  console.log('🔍 Starte CSV-Verarbeitung für alle Stationen...')
  
  // SSE-Schutz aktivieren
  setCSVProcessingState(true)
  
  try {
    const stations = ['ort', 'techno', 'heuballern', 'band']
    let totalInserted = 0
    
    for (const station of stations) {
      const csvDir = path.join(process.cwd(), 'public', 'csv', station)
      console.log(`📁 Überprüfe Verzeichnis: ${csvDir}`)
      
      if (!fs.existsSync(csvDir)) {
        console.log(`📁 Verzeichnis nicht gefunden: ${csvDir}`)
        continue
      }
      
      const csvFiles = fs.readdirSync(csvDir).filter(file => file.endsWith('.csv'))
      console.log(`📊 Gefunden: ${csvFiles.length} CSV-Dateien in ${station}`)
      
      for (const csvFile of csvFiles) {
        const csvPath = path.join(csvDir, csvFile)
        const insertedCount = await processCSVFile(station, csvPath)
        totalInserted += insertedCount
      }
    }
    
    console.log(`📊 Insgesamt ${totalInserted} Messwerte importiert`)
    return totalInserted
  } finally {
    // SSE-Schutz deaktivieren
    setCSVProcessingState(false)
  }
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