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
  private intervalHandle: NodeJS.Timeout | null = null
  private heartbeatPath = path.join(process.cwd(), 'backups', 'watcher-heartbeat.txt')

  constructor() {
    ensureCsvDirectories() // Ordner beim Start sicherstellen
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

  private writeHeartbeat() {
    try {
      const now = new Date().toISOString()
      fs.writeFileSync(this.heartbeatPath, now)
    } catch (e) {
      console.warn('[Watcher] Heartbeat konnte nicht geschrieben werden:', e)
    }
  }

  public start() {
    const config = getConfig()
    if (config.csvAutoProcess === false) {
      console.log('⏸️  Automatische CSV-Verarbeitung ist deaktiviert (csvAutoProcess=false)')
      return
    }
    if (this.isRunning) return
    this.isRunning = true
    this.initializeWatchedDirectories()
    console.log('🚀 Starting CSV file watcher...')
    this.checkForNewFiles()
    this.writeHeartbeat()
    this.intervalHandle = setInterval(() => {
      if (!this.isRunning) return
      try {
        this.checkForNewFiles()
        this.writeHeartbeat()
      } catch (e) {
        console.error('[Watcher] Fehler im Intervall:', e)
        this.restart()
      }
    }, this.checkInterval)
  }

  public restart() {
    console.warn('[Watcher] Neustart nach Fehler...')
    this.stop()
    setTimeout(() => this.start(), 2000)
  }

  public stop() {
    console.log('⏹️  Stopping CSV file watcher...')
    this.isRunning = false
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
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
          .sort((a, b) => b.mtime - a.mtime)
        // Check for new files (modified after last check)
        const newFiles = files.filter(file => file.mtime > dir.lastCheck)
        if (newFiles.length > 0) {
          console.log(`🆕 Found ${newFiles.length} new CSV file(s) for ${dir.station}:`)
          for (const file of newFiles) {
            console.log(`  📄 Processing: ${file.name}`)
            // Hier: Datei direkt verarbeiten
            const inserted = processCSVFile(dir.station, file.path)
            if (inserted > 0) {
              console.log(`  ✅ ${file.name}: ${inserted} measurements inserted`)
            } else {
              console.log(`  ⏭️  ${file.name}: Already processed or no new data`)
            }
          }
        }
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
        // ... bestehende Verarbeitung ...
      } catch (e) {
        // ...
      }
    }
  }
}

const csvWatcher = new CSVWatcher()
export default csvWatcher 