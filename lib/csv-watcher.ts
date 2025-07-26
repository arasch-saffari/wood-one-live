import fs from 'fs'
import path from 'path'
import chokidar from 'chokidar'
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
  private checkInterval = 300000 // Fallback check every 5 minutes (reduced from 10 seconds)
  private intervalHandle: NodeJS.Timeout | null = null
  private heartbeatPath = path.join(process.cwd(), 'backups', 'watcher-heartbeat.txt')
  private fsWatcher: chokidar.FSWatcher | null = null
  private processingQueue = new Set<string>() // Debounce-Mechanismus

  constructor() {
    // Keine Initialisierung mehr im Konstruktor!
  }

  private initializeWatchedDirectories() {
    const stations = ['ort', 'techno', 'heuballern', 'band']
    console.log(`🔍 [CSV Watcher] Initializing watched directories...`)
    console.log(`🔍 [CSV Watcher] Current working directory: ${process.cwd()}`)
    console.log(`🔍 [CSV Watcher] NODE_ENV: ${process.env.NODE_ENV}`)
    
    for (const station of stations) {
      const csvDir = path.join(process.cwd(), "public", "csv", station)
      console.log(`🔍 [CSV Watcher] Checking directory: ${csvDir}`)
      
      if (fs.existsSync(csvDir)) {
        console.log(`✅ [CSV Watcher] Directory exists: ${csvDir}`)
        const files = fs.readdirSync(csvDir).filter(file => file.endsWith('.csv'))
        console.log(`📊 [CSV Watcher] Found ${files.length} CSV files in ${station}`)
        
        this.watchedDirs.push({
          path: csvDir,
          station,
          lastCheck: Date.now()
        })
      } else {
        console.log(`❌ [CSV Watcher] Directory does not exist: ${csvDir}`)
      }
    }
    
    console.log(`🔍 [CSV Watcher] Total watched directories: ${this.watchedDirs.length}`)
    console.log(`🔍 [CSV Watcher] Watched stations: ${this.watchedDirs.map(d => d.station).join(', ')}`)
  }

  private writeHeartbeat() {
    try {
      const now = new Date().toISOString()
      fs.writeFileSync(this.heartbeatPath, now)
    } catch {
      // intentionally ignored
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
    
    // Initial-Import aller vorhandenen CSVs
    this.processAllFiles().then(({ totalInserted, processedFiles }) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Initial-Import abgeschlossen: ${totalInserted} Messwerte aus ${processedFiles} Dateien importiert.`)
      }
    }).catch(e => {
      console.error('❌ Fehler beim Initial-Import:', e)
    })

    // FS-Events-basierte Überwachung mit chokidar
    this.setupFileSystemWatcher()
    
    this.writeHeartbeat()
    
    // Fallback-Polling (reduziert auf 5 Minuten)
    this.intervalHandle = setInterval(() => {
      if (!this.isRunning) return
      try {
        this.checkForNewFiles()
        this.writeHeartbeat()
      } catch {
        this.restart()
      }
    }, this.checkInterval)
  }

  public restart() {
    this.stop()
    setTimeout(() => this.start(), 2000)
  }

  private setupFileSystemWatcher() {
    if (this.fsWatcher) {
      this.fsWatcher.close()
    }

    // Überwache alle CSV-Verzeichnisse
    const watchPaths = this.watchedDirs.map(dir => path.join(dir.path, '*.csv'))
    
    this.fsWatcher = chokidar.watch(watchPaths, {
      persistent: true,
      ignoreInitial: true, // Ignoriere existierende Dateien beim Start
      awaitWriteFinish: {
        stabilityThreshold: 2000, // Warte 2s nach letzter Änderung
        pollInterval: 100
      }
    })

    this.fsWatcher
      .on('add', (filePath) => this.handleFileEvent('add', filePath))
      .on('change', (filePath) => this.handleFileEvent('change', filePath))
      .on('error', (error) => {
        console.error('FS-Watcher Fehler:', error)
        // Fallback auf Polling bei FS-Watcher-Fehlern
      })

    if (process.env.NODE_ENV === 'development') {
      console.log('📁 FS-Events-Watcher gestartet für:', watchPaths)
    }
  }

  private async handleFileEvent(event: 'add' | 'change', filePath: string) {
    // Debounce: Verhindere mehrfache Verarbeitung derselben Datei
    if (this.processingQueue.has(filePath)) {
      return
    }

    // Filtere nur CSV-Dateien und ignoriere temporäre Dateien
    if (!filePath.endsWith('.csv') || path.basename(filePath).startsWith('_gsdata_')) {
      return
    }

    this.processingQueue.add(filePath)

    try {
      // Bestimme Station aus Pfad
      const station = this.getStationFromPath(filePath)
      if (!station) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️  Konnte Station für ${filePath} nicht bestimmen`)
        }
        return
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`📄 FS-Event (${event}): ${path.basename(filePath)} in ${station}`)
      }

      const inserted = await processCSVFile(station, filePath)
      
      if (process.env.NODE_ENV === 'development') {
        if (inserted > 0) {
          console.log(`✅ ${inserted} Messwerte aus ${path.basename(filePath)} importiert (FS-Event)`)
        } else {
          console.log(`⚠️  Keine neuen Messwerte aus ${path.basename(filePath)} (FS-Event)`)
        }
      }
    } catch (error) {
      console.error(`❌ Fehler beim Verarbeiten von ${filePath}:`, error)
    } finally {
      // Entferne aus Queue nach kurzer Verzögerung
      setTimeout(() => {
        this.processingQueue.delete(filePath)
      }, 5000)
    }
  }

  private getStationFromPath(filePath: string): string | null {
    for (const dir of this.watchedDirs) {
      if (filePath.startsWith(dir.path)) {
        return dir.station
      }
    }
    return null
  }

  public stop() {
    this.isRunning = false
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
    if (this.fsWatcher) {
      this.fsWatcher.close()
      this.fsWatcher = null
    }
    this.processingQueue.clear()
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
            const inserted = await processCSVFile(dir.station, file.path)
            if (process.env.NODE_ENV === 'development') {
              if (inserted > 0) {
                console.log(`✅ ${inserted} Messwerte aus ${file.name} importiert`)
              } else {
                console.log(`⚠️  Keine neuen Messwerte aus ${file.name}`)
              }
            }
          }
        }
        dir.lastCheck = Date.now()
      } catch (error) {
        console.error('Fehler beim Überprüfen neuer Dateien:', error)
      }
    }
  }

  // Manual trigger for processing all files
  public async processAllFiles() {
    console.log(`🔍 [CSV Watcher] Starting processAllFiles...`)
    console.log(`🔍 [CSV Watcher] Watched directories: ${this.watchedDirs.length}`)
    
    let totalInserted = 0
    let processedFiles = 0
    const lockPath = path.join(process.cwd(), 'backups', 'csv-processing.lock')
    fs.writeFileSync(lockPath, 'processing')
    try {
      for (const dir of this.watchedDirs) {
        console.log(`🔍 [CSV Watcher] Processing directory: ${dir.path} (station: ${dir.station})`)
        try {
          const files = fs.readdirSync(dir.path)
            .filter(file => file.endsWith('.csv') && !file.startsWith('_gsdata_'))
          
          console.log(`📊 [CSV Watcher] Found ${files.length} CSV files in ${dir.station}`)
          
          for (const file of files) {
            const filePath = path.join(dir.path, file)
            console.log(`📄 [CSV Watcher] Processing file: ${file}`)
            
            const inserted = await processCSVFile(dir.station, filePath)
            processedFiles++
            if (inserted > 0) {
              totalInserted += inserted
              console.log(`✅ [CSV Watcher] ${inserted} rows inserted from ${file}`)
            } else {
              console.log(`⚠️  [CSV Watcher] No new measurements from ${file}`)
            }
          }
        } catch (error) {
          console.error(`❌ [CSV Watcher] Error processing ${dir.station}:`, error)
        }
      }
    } finally {
      if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath)
    }
    
    console.log(`🔍 [CSV Watcher] ProcessAllFiles completed: ${totalInserted} total inserted, ${processedFiles} files processed`)
    return { totalInserted, processedFiles }
  }
}

// Singleton für Event-Listener-Registrierung
let eventListenersRegistered = false

const csvWatcher = new CSVWatcher()
export default csvWatcher

// Cleanup-Funktion für Ressourcenfreigabe
export function cleanupCsvWatcher() {
  const watcher = (globalThis as Record<string, unknown>)['csvWatcherInstance']
  if (watcher && typeof watcher === 'object' && typeof (watcher as { stop?: () => void }).stop === 'function') {
    try {
      (watcher as { stop: () => void }).stop()
    } catch (error) {
      console.error('Fehler beim Cleanup des CSV-Watchers:', error)
    }
  }
}

// Registriere Cleanup bei Prozessende (nur einmal)
if (typeof process !== 'undefined' && process.on && !eventListenersRegistered) {
  eventListenersRegistered = true
  process.on('SIGINT', () => {
    cleanupCsvWatcher()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    cleanupCsvWatcher()
    process.exit(0)
  })
} 