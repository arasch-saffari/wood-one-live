import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { csvImportCoordinator } from './csv-import-coordinator';
import { invalidateStationCache } from './table-data-service';
import { intelligentCache } from './intelligent-cache';

interface WatcherStats {
  filesProcessed: number;
  lastActivity: Date | null;
  errors: number;
  isActive: boolean;
  watchedDirectories: string[];
}

export class EnhancedCSVWatcher extends EventEmitter {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private isRunning = false;
  private stats: WatcherStats;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private processingQueue = new Set<string>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    super();
    this.stats = {
      filesProcessed: 0,
      lastActivity: null,
      errors: 0,
      isActive: false,
      watchedDirectories: []
    };
  }

  /**
   * Startet den Enhanced CSV Watcher
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📁 Enhanced CSV Watcher is already running');
      return;
    }

    console.log('🚀 Starting Enhanced CSV Watcher...');
    this.isRunning = true;
    this.stats.isActive = true;

    try {
      // Erstelle CSV-Verzeichnisse falls nicht vorhanden
      await this.ensureDirectories();
      
      // Setup File System Watchers
      await this.setupWatchers();
      
      // Starte Heartbeat
      this.startHeartbeat();
      
      // Initial-Import aller vorhandenen Dateien
      await this.processExistingFiles();
      
      console.log('✅ Enhanced CSV Watcher started successfully');
      this.emit('started');
      
    } catch (error) {
      console.error('❌ Failed to start Enhanced CSV Watcher:', error);
      this.stats.errors++;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stoppt den Watcher
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('⏹️  Stopping Enhanced CSV Watcher...');
    this.isRunning = false;
    this.stats.isActive = false;

    // Stoppe alle File Watchers
    for (const [path, watcher] of this.watchers) {
      try {
        await watcher.close();
        console.log(`📁 Stopped watching: ${path}`);
      } catch (error) {
        console.warn(`⚠️  Error stopping watcher for ${path}:`, error);
      }
    }
    this.watchers.clear();

    // Stoppe Heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Cleanup Debounce Timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    console.log('✅ Enhanced CSV Watcher stopped');
    this.emit('stopped');
  }

  /**
   * Erstellt CSV-Verzeichnisse für alle Stationen
   */
  private async ensureDirectories(): Promise<void> {
    const stations = ['ort', 'techno', 'heuballern', 'band'];
    const baseDir = path.join(process.cwd(), 'public', 'csv');

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    for (const station of stations) {
      const stationDir = path.join(baseDir, station);
      if (!fs.existsSync(stationDir)) {
        fs.mkdirSync(stationDir, { recursive: true });
        console.log(`📁 Created directory: ${stationDir}`);
      }
      this.stats.watchedDirectories.push(stationDir);
    }
  }

  /**
   * Setup File System Watchers für alle Stationen
   */
  private async setupWatchers(): Promise<void> {
    const stations = ['ort', 'techno', 'heuballern', 'band'];

    for (const station of stations) {
      const watchPath = path.join(process.cwd(), 'public', 'csv', station);
      
      try {
        const watcher = chokidar.watch(watchPath, {
          ignored: /(^|[\/\\])\../, // Ignoriere versteckte Dateien
          persistent: true,
          ignoreInitial: true, // Ignoriere existierende Dateien beim Start
          awaitWriteFinish: {
            stabilityThreshold: 2000, // Warte 2s nach letzter Änderung
            pollInterval: 100
          }
        });

        // Event-Handler
        watcher
          .on('add', (filePath) => this.handleFileAdded(station, filePath))
          .on('change', (filePath) => this.handleFileChanged(station, filePath))
          .on('unlink', (filePath) => this.handleFileRemoved(station, filePath))
          .on('error', (error) => this.handleWatcherError(station, error));

        this.watchers.set(station, watcher);
        console.log(`👀 Watching ${station}: ${watchPath}`);

      } catch (error) {
        console.error(`❌ Failed to setup watcher for ${station}:`, error);
        this.stats.errors++;
      }
    }
  }

  /**
   * Behandelt neue CSV-Dateien
   */
  private async handleFileAdded(station: string, filePath: string): Promise<void> {
    if (!this.isCSVFile(filePath)) return;

    console.log(`📥 New CSV file detected: ${station}/${path.basename(filePath)}`);
    
    // Debounce für schnelle Änderungen
    this.debounceFileProcessing(station, filePath, async () => {
      try {
        await this.processFile(station, filePath);
        this.stats.filesProcessed++;
        this.stats.lastActivity = new Date();
        
        // Trigger Frontend-Update
        this.triggerFrontendUpdate(station, 'file_added', filePath);
        
      } catch (error) {
        console.error(`❌ Error processing new file ${filePath}:`, error);
        this.stats.errors++;
        this.emit('error', { station, filePath, error });
      }
    });
  }

  /**
   * Behandelt geänderte CSV-Dateien
   */
  private async handleFileChanged(station: string, filePath: string): Promise<void> {
    if (!this.isCSVFile(filePath)) return;

    console.log(`📝 CSV file changed: ${station}/${path.basename(filePath)}`);
    
    this.debounceFileProcessing(station, filePath, async () => {
      try {
        await this.processFile(station, filePath);
        this.stats.lastActivity = new Date();
        
        // Trigger Frontend-Update
        this.triggerFrontendUpdate(station, 'file_changed', filePath);
        
      } catch (error) {
        console.error(`❌ Error processing changed file ${filePath}:`, error);
        this.stats.errors++;
      }
    });
  }

  /**
   * Behandelt gelöschte CSV-Dateien
   */
  private async handleFileRemoved(station: string, filePath: string): Promise<void> {
    if (!this.isCSVFile(filePath)) return;

    console.log(`🗑️  CSV file removed: ${station}/${path.basename(filePath)}`);
    
    // Invalidiere Cache für die Station
    await this.invalidateStationData(station);
    
    // Trigger Frontend-Update
    this.triggerFrontendUpdate(station, 'file_removed', filePath);
  }

  /**
   * Behandelt Watcher-Fehler
   */
  private handleWatcherError(station: string, error: Error): void {
    console.error(`❌ Watcher error for ${station}:`, error);
    this.stats.errors++;
    this.emit('error', { station, error });
    
    // Versuche Watcher neu zu starten
    setTimeout(() => {
      this.restartWatcher(station);
    }, 5000);
  }

  /**
   * Startet einen Watcher für eine Station neu
   */
  private async restartWatcher(station: string): Promise<void> {
    try {
      const existingWatcher = this.watchers.get(station);
      if (existingWatcher) {
        await existingWatcher.close();
      }

      const watchPath = path.join(process.cwd(), 'public', 'csv', station);
      const watcher = chokidar.watch(watchPath, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        }
      });

      watcher
        .on('add', (filePath) => this.handleFileAdded(station, filePath))
        .on('change', (filePath) => this.handleFileChanged(station, filePath))
        .on('unlink', (filePath) => this.handleFileRemoved(station, filePath))
        .on('error', (error) => this.handleWatcherError(station, error));

      this.watchers.set(station, watcher);
      console.log(`🔄 Restarted watcher for ${station}`);

    } catch (error) {
      console.error(`❌ Failed to restart watcher for ${station}:`, error);
    }
  }

  /**
   * Debounce-Mechanismus für Datei-Verarbeitung
   */
  private debounceFileProcessing(station: string, filePath: string, callback: () => Promise<void>): void {
    const key = `${station}:${filePath}`;
    
    // Lösche existierenden Timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Setze neuen Timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      await callback();
    }, 1000); // 1 Sekunde Debounce

    this.debounceTimers.set(key, timer);
  }

  /**
   * Verarbeitet eine CSV-Datei über den Import-Koordinator
   */
  private async processFile(station: string, filePath: string): Promise<void> {
    if (this.processingQueue.has(filePath)) {
      console.log(`⏳ File already in processing queue: ${filePath}`);
      return;
    }

    this.processingQueue.add(filePath);

    try {
      // Verwende den optimierten Import-Koordinator
      const jobId = await csvImportCoordinator.addImportJob(station, filePath, 'high');
      console.log(`📊 Queued CSV import job: ${jobId} for ${station}/${path.basename(filePath)}`);
      
      // Invalidiere Cache für die Station
      await this.invalidateStationData(station);
      
    } finally {
      this.processingQueue.delete(filePath);
    }
  }

  /**
   * Verarbeitet alle existierenden CSV-Dateien beim Start
   */
  private async processExistingFiles(): Promise<void> {
    console.log('📂 Processing existing CSV files...');
    
    const stations = ['ort', 'techno', 'heuballern', 'band'];
    let totalFiles = 0;

    for (const station of stations) {
      const stationDir = path.join(process.cwd(), 'public', 'csv', station);
      
      if (!fs.existsSync(stationDir)) continue;

      try {
        const files = fs.readdirSync(stationDir)
          .filter(file => this.isCSVFile(path.join(stationDir, file)))
          .map(file => path.join(stationDir, file));

        if (files.length > 0) {
          await csvImportCoordinator.addDirectoryImport(station, stationDir, 'normal');
          totalFiles += files.length;
          console.log(`📁 Queued ${files.length} existing files for ${station}`);
        }

      } catch (error) {
        console.error(`❌ Error processing existing files for ${station}:`, error);
        this.stats.errors++;
      }
    }

    console.log(`📊 Total existing files queued: ${totalFiles}`);
  }

  /**
   * Invalidiert Cache-Daten für eine Station
   */
  private async invalidateStationData(station: string): Promise<void> {
    try {
      await invalidateStationCache(station);
      await intelligentCache.invalidateByTags([`station_${station}`, 'table_data']);
      console.log(`🧹 Cache invalidated for station: ${station}`);
    } catch (error) {
      console.warn(`⚠️  Failed to invalidate cache for ${station}:`, error);
    }
  }

  /**
   * Triggert Frontend-Updates über SSE
   */
  private triggerFrontendUpdate(station: string, action: string, filePath: string): void {
    try {
      // Import der triggerDeltaUpdate Funktion
      const { triggerDeltaUpdate } = require('../app/api/updates/route');
      
      // Sende spezifische Update-Daten
      const updateData = {
        type: 'csv_update',
        station,
        action,
        fileName: path.basename(filePath),
        timestamp: new Date().toISOString()
      };

      // Trigger SSE-Update
      triggerDeltaUpdate(updateData);
      
      console.log(`📡 Frontend update triggered: ${action} for ${station}`);
      
    } catch (error) {
      console.warn('⚠️  Failed to trigger frontend update:', error);
    }
  }

  /**
   * Startet Heartbeat für Monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const heartbeatData = {
        timestamp: new Date().toISOString(),
        stats: this.getStats(),
        activeJobs: csvImportCoordinator.getStatus().activeJobs.length,
        queuedJobs: csvImportCoordinator.getStatus().queuedJobs.length
      };

      // Schreibe Heartbeat-Datei
      try {
        const heartbeatPath = path.join(process.cwd(), 'cache', 'csv-watcher-heartbeat.json');
        fs.writeFileSync(heartbeatPath, JSON.stringify(heartbeatData, null, 2));
      } catch (error) {
        console.warn('⚠️  Failed to write heartbeat:', error);
      }

      // Emit Heartbeat-Event
      this.emit('heartbeat', heartbeatData);

    }, 30000); // Alle 30 Sekunden
  }

  /**
   * Prüft ob Datei eine CSV-Datei ist
   */
  private isCSVFile(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.csv';
  }

  /**
   * Gibt aktuelle Statistiken zurück
   */
  getStats(): WatcherStats {
    return { ...this.stats };
  }

  /**
   * Gibt detaillierten Status zurück
   */
  getDetailedStatus(): {
    stats: WatcherStats;
    watchers: Array<{ station: string; isActive: boolean; path: string }>;
    processingQueue: string[];
    importStatus: any;
  } {
    const watcherStatus = Array.from(this.watchers.entries()).map(([station, watcher]) => ({
      station,
      isActive: !watcher.closed,
      path: path.join(process.cwd(), 'public', 'csv', station)
    }));

    return {
      stats: this.getStats(),
      watchers: watcherStatus,
      processingQueue: Array.from(this.processingQueue),
      importStatus: csvImportCoordinator.getStatus()
    };
  }
}

// Singleton-Instanz
export const enhancedCSVWatcher = new EnhancedCSVWatcher();

// Auto-Start wenn Background-Jobs aktiviert sind
if (process.env.ENABLE_BACKGROUND_JOBS === 'true') {
  enhancedCSVWatcher.start().catch(error => {
    console.error('❌ Failed to auto-start Enhanced CSV Watcher:', error);
  });
}

// Cleanup bei Prozessende
if (typeof process !== 'undefined' && process.on) {
  const cleanup = async () => {
    console.log('🧹 Cleaning up Enhanced CSV Watcher...');
    await enhancedCSVWatcher.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}