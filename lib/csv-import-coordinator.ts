import { EventEmitter } from 'events';
import { processCSVFile } from './csv-processing';
import { DatabaseOptimizer } from './database-optimizer';
import { intelligentCache } from './intelligent-cache';
import { invalidateStationCache, warmupTableDataCache } from './table-data-service';
import fs from 'fs';
import path from 'path';
import { setCSVProcessingState } from '@/app/api/updates/route'

interface ImportJob {
  id: string;
  station: string;
  filePath: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  startTime?: number;
  endTime?: number;
  result?: {
    processed: number;
    errors: number;
    duration: number;
  };
  error?: string;
}

interface ImportStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalProcessed: number;
  totalErrors: number;
  avgProcessingTime: number;
  queueLength: number;
}

export class CSVImportCoordinator extends EventEmitter {
  private queue: ImportJob[] = [];
  private activeJobs: Map<string, ImportJob> = new Map();
  private completedJobs: ImportJob[] = [];
  private maxConcurrentJobs: number;
  private dbOptimizer: DatabaseOptimizer;
  private isProcessing = false;
  private stats: ImportStats;

  constructor(options: {
    maxConcurrentJobs?: number;
  } = {}) {
    super();
    
    this.maxConcurrentJobs = options.maxConcurrentJobs || Math.max(2, Math.floor(require('os').cpus().length / 2));
    
    // Import database for optimizer
    const db = require('./database').default;
    this.dbOptimizer = new DatabaseOptimizer(db);
    
    this.stats = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      totalProcessed: 0,
      totalErrors: 0,
      avgProcessingTime: 0,
      queueLength: 0
    };

    this.startProcessingLoop();
    this.setupPeriodicOptimization();
  }

  /**
   * Fügt einen Import-Job zur Queue hinzu
   */
  async addImportJob(
    station: string, 
    filePath: string, 
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  ): Promise<string> {
    const jobId = this.generateJobId();
    
    const job: ImportJob = {
      id: jobId,
      station,
      filePath,
      priority,
      status: 'pending',
      progress: 0
    };

    // Prüfe ob Datei existiert
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found: ${filePath}`);
    }

    // Füge zur Queue hinzu (sortiert nach Priorität)
    this.insertJobByPriority(job);
    this.stats.totalJobs++;
    this.updateQueueStats();

    this.emit('jobAdded', job);
    console.log(`📥 Import job added: ${jobId} (${station}, priority: ${priority})`);

    return jobId;
  }

  /**
   * Fügt mehrere CSV-Dateien aus einem Verzeichnis hinzu
   */
  async addDirectoryImport(
    station: string, 
    directoryPath: string, 
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  ): Promise<string[]> {
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`Directory not found: ${directoryPath}`);
    }

    const csvFiles = fs.readdirSync(directoryPath)
      .filter(file => file.endsWith('.csv'))
      .map(file => path.join(directoryPath, file));

    const jobIds: string[] = [];
    
    for (const filePath of csvFiles) {
      const jobId = await this.addImportJob(station, filePath, priority);
      jobIds.push(jobId);
    }

    console.log(`📁 Added ${jobIds.length} CSV files from directory: ${directoryPath}`);
    return jobIds;
  }

  /**
   * Startet Bulk-Import für alle Stationen
   */
  async startBulkImport(): Promise<{ jobIds: string[]; estimatedDuration: number }> {
    const stations = ['ort', 'techno', 'heuballern', 'band'];
    const allJobIds: string[] = [];
    let totalFiles = 0;

    console.log('🚀 Starting bulk CSV import for all stations...');

    // Optimiere Datenbank vor Bulk-Import
    await this.dbOptimizer.optimizeForLargeDatasets();

    for (const station of stations) {
      const csvDir = path.join(process.cwd(), 'public', 'csv', station);
      
      if (fs.existsSync(csvDir)) {
        try {
          const jobIds = await this.addDirectoryImport(station, csvDir, 'high');
          allJobIds.push(...jobIds);
          totalFiles += jobIds.length;
        } catch (error) {
          console.warn(`⚠️  Failed to add directory for station ${station}:`, error);
        }
      }
    }

    // Schätze Verarbeitungszeit (basierend auf historischen Daten)
    const avgTimePerFile = this.stats.avgProcessingTime || 30000; // 30s default
    const estimatedDuration = Math.ceil((totalFiles * avgTimePerFile) / this.maxConcurrentJobs);

    console.log(`📊 Bulk import queued: ${totalFiles} files, estimated duration: ${Math.round(estimatedDuration / 1000)}s`);

    return { jobIds: allJobIds, estimatedDuration };
  }

  /**
   * Hauptverarbeitungsschleife
   */
  private async startProcessingLoop(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.isProcessing) {
      try {
        // Verarbeite Jobs wenn Kapazität verfügbar
        while (this.activeJobs.size < this.maxConcurrentJobs && this.queue.length > 0) {
          const job = this.queue.shift()!;
          await this.processJob(job);
        }

        // Warte kurz bevor nächste Iteration
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error('❌ Error in processing loop:', error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Längere Pause bei Fehlern
      }
    }
  }

  /**
   * Verarbeitet einen einzelnen Job
   */
  private async processJob(job: ImportJob): Promise<void> {
    try {
      console.log(`🔄 Processing job: ${job.id} (${job.station})`)
      
      // SSE-Schutz aktivieren während Job-Verarbeitung
      setCSVProcessingState(true)
      
      const startTime = Date.now()
      const insertedCount = await processCSVFile(job.station, job.filePath)
      const duration = Date.now() - startTime
      
      job.result = {
        processed: insertedCount,
        errors: 0,
        duration
      }
      
      console.log(`📈 Job metrics: ${job.id} - ${insertedCount} rows in ${duration}ms`)
      console.log(`✅ Job completed: ${job.id} (${insertedCount} rows, ${duration}ms)`)
      
    } catch (error) {
      console.error(`❌ Job failed: ${job.id}`, error)
      job.result = {
        processed: 0,
        errors: 1,
        duration: Date.now() - job.startTime! // Assuming startTime is set before this block
      }
    } finally {
      // SSE-Schutz deaktivieren
      setCSVProcessingState(false)
    }
  }

  /**
   * Fügt Job sortiert nach Priorität in Queue ein
   */
  private insertJobByPriority(job: ImportJob): void {
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityOrder[job.priority] < priorityOrder[this.queue[i].priority]) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, job);
  }

  /**
   * Generiert eindeutige Job-ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Aktualisiert Queue-Statistiken
   */
  private updateQueueStats(): void {
    this.stats.queueLength = this.queue.length;
  }

  /**
   * Aktualisiert durchschnittliche Verarbeitungszeit
   */
  private updateAvgProcessingTime(): void {
    const completedWithDuration = this.completedJobs.filter(job => 
      job.result && job.startTime && job.endTime
    );
    
    if (completedWithDuration.length > 0) {
      const totalDuration = completedWithDuration.reduce((sum, job) => 
        sum + (job.endTime! - job.startTime!), 0
      );
      this.stats.avgProcessingTime = totalDuration / completedWithDuration.length;
    }
  }

  /**
   * Plant Cache-Warmup nach Import
   */
  private scheduleWarmup(station: string): void {
    // Warte 5 Sekunden nach Import, dann wärme Cache
    setTimeout(async () => {
      try {
        await warmupTableDataCache();
        console.log(`🔥 Cache warmed up after import for station: ${station}`);
      } catch (error) {
        console.warn('⚠️  Cache warmup failed:', error);
      }
    }, 5000);
  }

  /**
   * Setup für periodische Datenbankoptimierung
   */
  private setupPeriodicOptimization(): void {
    // Alle 30 Minuten Aggregate aktualisieren - DEAKTIVIERT wegen fehlender Tabelle
    /*
    setInterval(async () => {
      try {
        await this.dbOptimizer.updateHourlyAggregates();
        console.log('📊 Hourly aggregates updated');
      } catch (error) {
        console.warn('⚠️  Failed to update hourly aggregates:', error);
      }
    }, 30 * 60 * 1000);
    */
    console.log('⚠️  Hourly aggregates update disabled - table does not exist');

    // Täglich um 3 Uhr: Volloptimierung
    const now = new Date();
    const tomorrow3AM = new Date(now);
    tomorrow3AM.setDate(tomorrow3AM.getDate() + 1);
    tomorrow3AM.setHours(3, 0, 0, 0);
    
    const msUntil3AM = tomorrow3AM.getTime() - now.getTime();
    
    setTimeout(() => {
      this.runDailyOptimization();
      // Dann alle 24 Stunden wiederholen
      setInterval(() => this.runDailyOptimization(), 24 * 60 * 60 * 1000);
    }, msUntil3AM);
  }

  /**
   * Tägliche Datenbankoptimierung
   */
  private async runDailyOptimization(): Promise<void> {
    console.log('🔧 Starting daily database optimization...');
    
    try {
      // Aktualisiere tägliche Aggregate - mit Fehlerbehandlung
      try {
        await this.dbOptimizer.updateDailyAggregates();
        console.log('✅ Daily aggregates updated');
      } catch (error) {
        console.warn('⚠️  Failed to update daily aggregates:', error);
      }
      
      // Bereinige alte Daten - mit Fehlerbehandlung
      try {
        const cleanup = await this.dbOptimizer.cleanupOldData();
        console.log(`🧹 Cleaned up ${cleanup.deletedRows} old records from ${cleanup.tables.join(', ')}`);
      } catch (error) {
        console.warn('⚠️  Failed to cleanup old data:', error);
      }
      
      // Optimiere Datenbank - mit Fehlerbehandlung
      try {
        await this.dbOptimizer.optimizeDatabase();
        console.log('✅ Database optimized');
      } catch (error) {
        console.warn('⚠️  Failed to optimize database:', error);
      }
      
      // Bereinige Cache - mit Fehlerbehandlung
      try {
        await intelligentCache.clear();
        console.log('✅ Cache cleared');
      } catch (error) {
        console.warn('⚠️  Failed to clear cache:', error);
      }
      
      console.log('✅ Daily optimization completed');
    } catch (error) {
      console.error('❌ Daily optimization failed:', error);
    }
  }

  /**
   * Gibt aktuellen Status zurück
   */
  getStatus(): {
    stats: ImportStats;
    activeJobs: ImportJob[];
    queuedJobs: ImportJob[];
    recentCompleted: ImportJob[];
  } {
    return {
      stats: { ...this.stats },
      activeJobs: Array.from(this.activeJobs.values()),
      queuedJobs: [...this.queue],
      recentCompleted: this.completedJobs.slice(-10) // Letzte 10
    };
  }

  /**
   * Pausiert die Verarbeitung
   */
  pause(): void {
    this.isProcessing = false;
    console.log('⏸️  Import processing paused');
  }

  /**
   * Setzt die Verarbeitung fort
   */
  resume(): void {
    if (!this.isProcessing) {
      this.startProcessingLoop();
      console.log('▶️  Import processing resumed');
    }
  }

  /**
   * Bricht einen Job ab
   */
  async cancelJob(jobId: string): Promise<boolean> {
    // Entferne aus Queue
    const queueIndex = this.queue.findIndex(job => job.id === jobId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
      console.log(`❌ Job cancelled from queue: ${jobId}`);
      return true;
    }

    // Aktive Jobs können nicht abgebrochen werden (würde Datenbank inkonsistent machen)
    if (this.activeJobs.has(jobId)) {
      console.warn(`⚠️  Cannot cancel active job: ${jobId}`);
      return false;
    }

    return false;
  }

  /**
   * Cleanup-Methode
   */
  async cleanup(): Promise<void> {
    this.isProcessing = false;
    
    // Warte auf aktive Jobs
    while (this.activeJobs.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // No specific cleanup for the new processCSVFile, as it's a direct function call.
    // If the streaming processor had specific cleanup, it would be here.
    console.log('🧹 CSV Import Coordinator cleanup completed');
  }
}

// Singleton-Instanz
export const csvImportCoordinator = new CSVImportCoordinator({
  maxConcurrentJobs: Math.max(2, Math.floor(require('os').cpus().length / 2))
});

// Event-Listener für Monitoring
csvImportCoordinator.on('jobCompleted', (job) => {
  console.log(`📈 Job metrics: ${job.id} - ${job.result?.processed} rows in ${job.result?.duration}ms`);
});

csvImportCoordinator.on('jobFailed', (job) => {
  console.error(`📉 Job failed: ${job.id} - ${job.error}`);
});