import fs from 'fs'
import path from 'path'
import { processCSVFile } from './csv-processing'

function getConfig() {
  const configPath = path.join(process.cwd(), 'config.json')
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

interface WatchedDirectory {
  path: string
  station: string
  lastCheck: number
}

// Hilfsfunktion: Erstelle alle CSV-Ordner, falls sie fehlen
function ensureCsvDirectories() {
  const stations = ['ort', 'techno', 'heuballern', 'band']
  const baseDir = path.join(process.cwd(), 'public', 'csv')
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true })
  }
  for (const station of stations) {
    const dir = path.join(baseDir, station)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`📁 CSV-Ordner automatisch angelegt: ${dir}`)
    }
  }
}

class CSVWatcher {
  private watchedDirs: WatchedDirectory[] = []
  private isRunning = false
  private checkInterval = 10000 // Check every 10 seconds

  constructor() {
    ensureCsvDirectories() // Ordner beim Start sicherstellen
    // Starte nur, wenn csvAutoProcess true ist
    const config = getConfig()
    if (config.csvAutoProcess !== false) {
      this.start()
    } else {
      console.log('⏸️  Automatische CSV-Verarbeitung ist deaktiviert (csvAutoProcess=false)')
    }
  }

  private initializeWatchedDirectories() {
    const stations = ['ort', 'techno', 'heuballern', 'band']
    
    for (const station of stations) {
      const csvDir = path.join(process.cwd(), "public", "csv", station)
      if (fs.existsSync(csvDir)) {
        this.watchedDirs.push({
          path: csvDir,
          station,
          lastCheck: Date.now()
        })
        console.log(`👁️  Watching CSV directory: ${csvDir}`)
      }
    }
  }

  public start() {
    // Prüfe erneut die Config
    const config = getConfig()
    if (config.csvAutoProcess === false) {
      console.log('⏸️  Automatische CSV-Verarbeitung ist deaktiviert (csvAutoProcess=false)')
      return
    }
    if (this.isRunning) return
    
    console.log('🚀 Starting CSV file watcher...')
    this.isRunning = true
    this.initializeWatchedDirectories()
    
    // Set up periodic checking
    setInterval(() => {
      if (this.isRunning) {
        this.checkForNewFiles()
      }
    }, this.checkInterval)
  }

  public stop() {
    console.log('⏹️  Stopping CSV file watcher...')
    this.isRunning = false
  }

  private async checkForNewFiles() {
    for (const dir of this.watchedDirs) {
      try {
        const files = fs.readdirSync(dir.path)
          .filter(file => file.endsWith('.csv') && !file.startsWith('_gsdata_'))
          .map(file => ({
            name: file,
            path: path.join(dir.path, file),
            mtime: fs.statSync(path.join(dir.path, file)).mtime.getTime()
          }))
          .sort((a, b) => b.mtime - a.mtime) // Sort by modification time, newest first

        // Check for new files (modified after last check)
        const newFiles = files.filter(file => file.mtime > dir.lastCheck)
        
        if (newFiles.length > 0) {
          console.log(`🆕 Found ${newFiles.length} new CSV file(s) for ${dir.station}:`)
          
          for (const file of newFiles) {
            console.log(`  📄 Processing: ${file.name}`)
            const inserted = processCSVFile(dir.station, file.path)
            
            if (inserted > 0) {
              console.log(`  ✅ ${file.name}: ${inserted} measurements inserted`)
            } else {
              console.log(`  ⏭️  ${file.name}: Already processed or no new data`)
            }
          }
        }
        
        // Update last check time
        dir.lastCheck = Date.now()
        
      } catch (error) {
        console.error(`❌ Error checking directory ${dir.path}:`, error)
      }
    }
  }

  // Manual trigger for processing all files
  public async processAllFiles() {
    console.log('🔄 Manual CSV processing triggered...')
    
    for (const dir of this.watchedDirs) {
      try {
        const files = fs.readdirSync(dir.path)
          .filter(file => file.endsWith('.csv') && !file.startsWith('_gsdata_'))
          .sort()
        
        console.log(`📁 Processing ${files.length} CSV files for ${dir.station}...`)
        
        for (const file of files) {
          const csvPath = path.join(dir.path, file)
          const inserted = processCSVFile(dir.station, csvPath)
          
          if (inserted > 0) {
            console.log(`  ✅ ${file}: ${inserted} measurements inserted`)
          }
        }
      } catch (error) {
        console.error(`❌ Error processing files for ${dir.station}:`, error)
      }
    }
  }
}

// Create singleton instance
const csvWatcher = new CSVWatcher()

export default csvWatcher 