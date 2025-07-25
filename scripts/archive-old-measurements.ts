import db from '../lib/database'
import { ParquetWriter, ParquetSchema } from 'parquetjs-lite'
import path from 'path'
import fs from 'fs'

const BACKUP_DIR = path.join(process.cwd(), 'backups')
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })

async function archiveOldMeasurements() {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const cutoffStr = cutoff.toISOString().slice(0, 19).replace('T', ' ')
  // Hole alle alten Messwerte
  const rows = db.prepare('SELECT * FROM measurements WHERE datetime < ?').all(cutoffStr)
  if (!rows.length) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Keine alten Messwerte zum Archivieren.')
    }
    return
  }
  // Parquet-Schema dynamisch aus erster Zeile
  const sample = rows[0] as Record<string, unknown>
  const schemaDef: Record<string, unknown> = {}
  for (const key of Object.keys(sample)) {
    if (typeof sample[key] === 'number') schemaDef[key] = { type: 'DOUBLE', optional: true }
    else schemaDef[key] = { type: 'UTF8', optional: true }
  }
  const schema = new ParquetSchema(schemaDef)
  const fileName = `measurements-archive-${cutoffStr.slice(0,7)}.parquet`
  const filePath = path.join(BACKUP_DIR, fileName)
  const writer = await ParquetWriter.openFile(schema, filePath)
  for (const row of rows) {
    await writer.appendRow(row)
  }
  await writer.close()
  // Lösche archivierte Zeilen
  const del = db.prepare('DELETE FROM measurements WHERE datetime < ?').run(cutoffStr)
  if (process.env.NODE_ENV === 'development') {
    console.log(`Archiviert: ${rows.length} Zeilen nach ${filePath}`)
    console.log(`Gelöscht: ${del.changes} Zeilen aus measurements`)
  }
}

archiveOldMeasurements().catch(e => {
  console.error('Fehler beim Archivieren:', e)
  process.exit(1)
}) 