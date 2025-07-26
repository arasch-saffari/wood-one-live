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

// Hilfsfunktionen für CSV-Verarbeitung
function parseCSVLine(line: string, station: string, fileName: string): any {
  try {
    const parts = line.split(';')
    if (parts.length < 2) return null
    
    // Suche nach Zeit- und Lärm-Spalten
    let sysTime = null
    let las = null
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim()
      
      // Zeit-Format: HH:MM:SS
      if (part.match(/^\d{1,2}:\d{1,2}:\d{1,2}$/)) {
        const timeParts = part.split(':')
        sysTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:${timeParts[2].padStart(2, '0')}`
      }
      
      // Lärm-Wert (numerisch)
      if (!las && !isNaN(Number(part.replace(',', '.')))) {
        las = Number(part.replace(',', '.'))
      }
    }
    
    if (!sysTime || !las) return null
    
    // Datum aus Dateiname oder aktuelles Datum
    const dateMatch = fileName.match(/(\d{2})\.(\d{2})\.(\d{4})/)
    let dateStr = null
    if (dateMatch) {
      dateStr = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
    } else {
      const now = new Date()
      dateStr = now.toISOString().split('T')[0]
    }
    
    const datetime = `${dateStr} ${sysTime}`
    const time = datetime
    
    return {
      station,
      time,
      las,
      source_file: fileName,
      datetime,
      all_csv_fields: JSON.stringify({ line, station, fileName })
    }
  } catch (error) {
    console.error(`❌ [CSV Processing] Error parsing line: ${error}`)
    return null
  }
}

async function insertBatch(db: any, batches: any[], hasDatetime: boolean): Promise<number> {
  if (batches.length === 0) return 0
  
  try {
    const stmt = hasDatetime 
      ? db.prepare('INSERT OR REPLACE INTO measurements (station, time, las, source_file, datetime, all_csv_fields) VALUES (?, ?, ?, ?, ?, ?)')
      : db.prepare('INSERT OR REPLACE INTO measurements (station, time, las, source_file, all_csv_fields) VALUES (?, ?, ?, ?, ?)')
    
    let insertedCount = 0
    for (const batch of batches) {
      try {
        const result = hasDatetime
          ? stmt.run(batch.station, batch.time, batch.las, batch.source_file, batch.datetime, batch.all_csv_fields)
          : stmt.run(batch.station, batch.time, batch.las, batch.source_file, batch.all_csv_fields)
        
        if (result.changes > 0) {
          insertedCount++
        }
      } catch (error) {
        console.error(`❌ [CSV Processing] Error inserting batch: ${error}`)
      }
    }
    
    return insertedCount
  } catch (error) {
    console.error(`❌ [CSV Processing] Error in insertBatch: ${error}`)
    return 0
  }
}

// Streaming-CSV-Verarbeitung mit inkrementellem Offset
export async function processCSVFile(station: string, filePath: string): Promise<number> {
  const startTime = Date.now()
  
  try {
    console.log(`🔍 [CSV Processing] Processing ${station}: ${path.basename(filePath)}`)
    
    // Debug: Prüfe Dateigröße
    const fileStat = fs.statSync(filePath)
    console.log(`🔍 [CSV Processing] File size: ${fileStat.size} bytes`)
    
    // Debug: Prüfe Offset-Datei
    const offsetFile = filePath.replace('.csv', '.meta.json')
    let offset = 0
    if (fs.existsSync(offsetFile)) {
      try {
        const offsetData = JSON.parse(fs.readFileSync(offsetFile, 'utf8'))
        offset = offsetData.offset || 0
        console.log(`🔍 [CSV Processing] Found offset: ${offset} for ${path.basename(filePath)}`)
      } catch (err) {
        console.log(`🔍 [CSV Processing] Error reading offset file: ${err}`)
      }
    } else {
      console.log(`🔍 [CSV Processing] No offset file found for ${path.basename(filePath)}`)
    }
    
    // Debug: Prüfe Dateiinhalt
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const lines = fileContent.split('\n').filter(line => line.trim())
    console.log(`🔍 [CSV Processing] Total lines in file: ${lines.length}`)
    console.log(`🔍 [CSV Processing] Lines after offset: ${lines.length - offset}`)
    
    if (lines.length <= offset) {
      console.log(`🔍 [CSV Processing] File already fully processed (${lines.length} <= ${offset})`)
      return 0
    }
    
    // Debug: Zeige erste paar Zeilen
    const sampleLines = lines.slice(offset, Math.min(offset + 5, lines.length))
    console.log(`🔍 [CSV Processing] Sample lines after offset:`)
    sampleLines.forEach((line, i) => {
      console.log(`🔍 [CSV Processing] Line ${offset + i}: ${line.substring(0, 100)}...`)
    })
    
    const db = (await import('./database')).default
    
    // Prüfe ob datetime Spalte existiert
    const columns = db.prepare("PRAGMA table_info(measurements)").all() as Array<{ name: string }>
    const hasDatetime = columns.some(col => col.name === 'datetime')
    console.log(`🔍 [CSV Processing] Database has datetime column: ${hasDatetime}`)
    
    let insertedCount = 0
    const batchSize = 1000
    const batches = []
    
    // Verarbeite Zeilen ab dem Offset
    for (let i = offset; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      try {
        const measurement = parseCSVLine(line, station, path.basename(filePath))
        if (measurement) {
          batches.push(measurement)
          
          if (batches.length >= batchSize) {
            const batchInserted = await insertBatch(db, batches, hasDatetime)
            insertedCount += batchInserted
            batches.length = 0
          }
        }
      } catch (error) {
        console.error(`❌ [CSV Processing] Error parsing line ${i + 1}: ${error}`)
        continue
      }
    }
    
    // Füge restliche Batches ein
    if (batches.length > 0) {
      const batchInserted = await insertBatch(db, batches, hasDatetime)
      insertedCount += batchInserted
    }
    
    // Speichere neuen Offset
    if (insertedCount > 0) {
      const newOffset = lines.length
      const offsetData = { offset: newOffset, lastProcessed: new Date().toISOString() }
      fs.writeFileSync(offsetFile, JSON.stringify(offsetData, null, 2))
      console.log(`🔍 [CSV Processing] Updated offset to ${newOffset}`)
    }
    
    const durationSec = (Date.now() - startTime) / 1000
    console.log(`✅ [CSV Processing] ${station}: ${path.basename(filePath)} - ${insertedCount} rows inserted in ${durationSec.toFixed(2)}s`)
    
    return insertedCount
  } catch (error) {
    console.error(`❌ [CSV Processing] Error processing ${filePath}:`, error)
    return 0
  }
}

export async function processAllCSVFiles(): Promise<number> {
  console.log('🔍 Starte CSV-Verarbeitung für alle Stationen...')
  
  // Debug-Logging für Deployment
  console.log(`🔍 [CSV Processing] Database path: ${process.env.DATABASE_PATH || './data.sqlite'}`)
  console.log(`🔍 [CSV Processing] Current working directory: ${process.cwd()}`)
  console.log(`🔍 [CSV Processing] NODE_ENV: ${process.env.NODE_ENV}`)
  console.log(`🔍 [CSV Processing] Platform: ${process.platform}`)
  
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
      
      // Debug: Zeige die ersten paar CSV-Dateien
      if (csvFiles.length > 0) {
        console.log(`📄 Erste CSV-Dateien in ${station}:`, csvFiles.slice(0, 3))
      }
      
      for (const csvFile of csvFiles) {
        const csvPath = path.join(csvDir, csvFile)
        console.log(`📄 Processing: ${csvPath}`)
        
        // Debug: Prüfe Dateigröße
        try {
          const stats = fs.statSync(csvPath)
          console.log(`📊 Dateigröße: ${stats.size} bytes`)
        } catch (err) {
          console.error(`❌ Fehler beim Lesen der Datei: ${csvPath}`, err)
        }
        
        const insertedCount = await processCSVFile(station, csvPath)
        totalInserted += insertedCount
        console.log(`📊 ${station}: ${csvFile} - ${insertedCount} rows inserted`)
      }
    }
    
    console.log(`📊 Insgesamt ${totalInserted} Messwerte importiert`)
    
    // Debug: Überprüfe Datenbank nach Import
    try {
      const db = (await import('./database')).default
      const result = db.prepare('SELECT station, COUNT(*) as count FROM measurements GROUP BY station').all()
      console.log(`🔍 [CSV Processing] Database contents after import:`, result)
      
      // Debug: Prüfe spezifisch techno und band
      const technoCount = db.prepare('SELECT COUNT(*) as count FROM measurements WHERE station = ?').get('techno') as { count: number } | undefined
      const bandCount = db.prepare('SELECT COUNT(*) as count FROM measurements WHERE station = ?').get('band') as { count: number } | undefined
      console.log(`🔍 [CSV Processing] Techno count: ${technoCount?.count}, Band count: ${bandCount?.count}`)
      
    } catch (dbError) {
      console.error(`❌ [CSV Processing] Error checking database:`, dbError)
    }
    
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