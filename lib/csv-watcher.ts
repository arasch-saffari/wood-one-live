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
    // Keine Initialisierung mehr im Konstruktor!
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
      }
    }
  }

  private writeHeartbeat() {
    try {
      const now = new Date().toISOString()
      fs.writeFileSync(this.heartbeatPath, now)
    } catch (e) {
    }
  }

  public start() {
    ensureCsvDirectories()
    const config = getConfig()
    if (config.csvAutoProcess === false) {
      return
    }
    if (this.isRunning) return
    this.isRunning = true
    this.initializeWatchedDirectories()
    this.checkForNewFiles()
    this.writeHeartbeat()
    this.intervalHandle = setInterval(() => {
      if (!this.isRunning) return
      try {
        this.checkForNewFiles()
        this.writeHeartbeat()
      } catch (e) {
        this.restart()
      }
    }, this.checkInterval)
  }

  public restart() {
    this.stop()
    setTimeout(() => this.start(), 2000)
  }

  public stop() {
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
          for (const file of newFiles) {
            // Hier: Datei direkt verarbeiten
            const inserted = processCSVFile(dir.station, file.path)
            if (inserted > 0) {
            } else {
            }
          }
        }
        dir.lastCheck = Date.now()
      } catch (error) {
      }
    }
  }

  // Manual trigger for processing all files
  public async processAllFiles() {
    for (const dir of this.watchedDirs) {
      try {
        const files = fs.readdirSync(dir.path)
          .filter(file => file.endsWith('.csv') && !file.startsWith('_gsdata_'))
        for (const file of files) {
          const filePath = path.join(dir.path, file)
          const inserted = processCSVFile(dir.station, filePath)
          if (inserted > 0) {
          } else {
          }
        }
      } catch (e) {
      }
    }
  }
}

const csvWatcher = new CSVWatcher()
export default csvWatcher 