import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { db } from './db'

// CSV Processing Functions
export function processCSVFile(station: string, csvPath: string) {
  try {
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
    
    // Aggregate into 15-min blocks
    const blocks: { [block: string]: number[] } = {}
    validRows.forEach((row) => {
      const sysTime = row["Systemzeit "]?.trim()
      const las = Number(row[noiseColumn].replace(",", "."))
      if (!sysTime || isNaN(las)) return
      
      // Parse time as HH:MM:SS:MS, use only HH:MM
      const [h, m] = sysTime.split(":")
      if (!h || !m) return
      const blockTime = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`
      if (!blocks[blockTime]) blocks[blockTime] = []
      blocks[blockTime].push(las)
    })
    
    // Insert aggregated data into database with file tracking
    let insertedCount = 0
    const insertStmt = db.prepare(
      'INSERT OR IGNORE INTO measurements (station, time, las, source_file) VALUES (?, ?, ?, ?)'
    )
    
    for (const [time, lasArr] of Object.entries(blocks)) {
      const las = Number((lasArr.reduce((a, b) => a + b, 0) / lasArr.length).toFixed(2))
      const result = insertStmt.run(station, time, las, fileName)
      if (result.changes > 0) insertedCount++
    }
    
    return insertedCount
  } catch (e) {
    console.error(`Error processing CSV for ${station}:`, e)
    return 0
  }
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
      
      const files = fs.readdirSync(csvDir)
        .filter(file => file.endsWith('.csv') && !file.startsWith('_gsdata_'))
        .sort() // Process oldest files first
      
      console.log(`📁 Processing ${files.length} CSV files for ${station}...`)
      
      for (const file of files) {
        const csvPath = path.join(csvDir, file)
        const inserted = processCSVFile(station, csvPath)
        totalInserted += inserted
        
        if (inserted > 0) {
          console.log(`  ✅ ${file}: ${inserted} measurements inserted`)
        }
      }
    } catch (e) {
      console.error(`❌ Error processing ${station}:`, e)
    }
  }
  
  console.log(`🎉 Total measurements inserted: ${totalInserted}`)
  return totalInserted
} 