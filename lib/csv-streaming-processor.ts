import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import { Transform, pipeline } from 'stream';
import { promisify } from 'util';
import csvParser from 'csv-parser';

const pipelineAsync = promisify(pipeline);

interface StreamingConfig {
  batchSize: number;
  maxWorkers: number;
  memoryLimit: number; // MB
  chunkSize: number; // Zeilen pro Chunk
}

const DEFAULT_CONFIG: StreamingConfig = {
  batchSize: 1000,
  maxWorkers: Math.max(2, Math.floor(require('os').cpus().length / 2)),
  memoryLimit: 512,
  chunkSize: 5000
};

export class StreamingCSVProcessor {
  private config: StreamingConfig;
  private activeWorkers: Set<Worker> = new Set();
  private processingQueue: Array<{ station: string; filePath: string; priority: number }> = [];
  private isProcessing = false;

  constructor(config: Partial<StreamingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Hauptmethode für Streaming-CSV-Verarbeitung
   */
  async processCSVFileStreaming(station: string, csvPath: string): Promise<{
    processed: number;
    errors: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;

    console.log(`🔄 Starting streaming processing: ${path.basename(csvPath)}`);

    try {
      // Erstelle Batch-Transform-Stream
      const batchTransform = this.createBatchTransform(station, csvPath);
      
      // Erstelle Database-Writer-Stream
      const dbWriter = this.createDatabaseWriterStream();

      // Pipeline: CSV → Batch → Database
      await pipelineAsync(
        fs.createReadStream(csvPath),
        csvParser({ separator: ';', mapHeaders: ({ header }) => header.trim() }),
        batchTransform,
        dbWriter
      );

      processed = batchTransform.processedCount;
      errors = batchTransform.errorCount;

    } catch (error) {
      console.error(`❌ Streaming processing failed for ${csvPath}:`, error);
      errors++;
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Streaming processing completed: ${processed} rows, ${errors} errors, ${duration}ms`);

    return { processed, errors, duration };
  }

  /**
   * Erstellt einen Transform-Stream für Batch-Verarbeitung
   */
  private createBatchTransform(station: string, fileName: string) {
    let batch: any[] = [];
    let processedCount = 0;
    let errorCount = 0;
    let lineNumber = 0;

    const transform = new Transform({
      objectMode: true,
      transform(chunk: any, encoding, callback) {
        lineNumber++;
        
        try {
          // Validiere und normalisiere Zeile
          const normalized = this.validateAndNormalizeRow(chunk, station, fileName, lineNumber);
          
          if (normalized.isValid) {
            batch.push(normalized.data);
            processedCount++;
          } else {
            errorCount++;
            console.debug(`⚠️  Skipping invalid row ${lineNumber}: ${normalized.error}`);
          }

          // Sende Batch wenn voll
          if (batch.length >= this.config.batchSize) {
            this.push({ type: 'batch', data: batch, station });
            batch = [];
          }

          callback();
        } catch (error) {
          errorCount++;
          console.warn(`❌ Error processing row ${lineNumber}:`, error);
          callback();
        }
      },

      flush(callback) {
        // Sende letzten Batch
        if (batch.length > 0) {
          this.push({ type: 'batch', data: batch, station });
        }
        this.push({ type: 'end', processedCount, errorCount });
        callback();
      }
    });

    // Füge Zähler als Properties hinzu
    (transform as any).processedCount = 0;
    (transform as any).errorCount = 0;

    // Update Zähler bei End-Event
    transform.on('data', (chunk) => {
      if (chunk.type === 'end') {
        (transform as any).processedCount = chunk.processedCount;
        (transform as any).errorCount = chunk.errorCount;
      }
    });

    return transform;
  }

  /**
   * Erstellt einen Database-Writer-Stream
   */
  private createDatabaseWriterStream() {
    return new Transform({
      objectMode: true,
      async transform(chunk: any, encoding, callback) {
        if (chunk.type === 'batch') {
          try {
            await this.writeBatchToDatabase(chunk.data, chunk.station);
            callback();
          } catch (error) {
            console.error('❌ Database batch write failed:', error);
            callback(error);
          }
        } else {
          callback();
        }
      }
    });
  }

  /**
   * Schreibt einen Batch in die Datenbank mit optimierter Performance
   */
  private async writeBatchToDatabase(batch: any[], station: string): Promise<void> {
    if (!batch.length) return;

    try {
      // Import database service
      const { DatabaseService } = require('./database');
      
      // Verwende Transaction für bessere Performance
      await DatabaseService.executeTransaction(() => {
        const stmt = require('./database').default.prepare(`
          INSERT OR REPLACE INTO measurements 
          (station, time, las, source_file, datetime, all_csv_fields) 
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const row of batch) {
          stmt.run(
            station,
            row.time,
            row.las,
            row.sourceFile,
            row.datetime,
            row.allCsvFields
          );
        }
      });

      console.debug(`✅ Batch written: ${batch.length} rows for ${station}`);
    } catch (error) {
      console.error(`❌ Failed to write batch for ${station}:`, error);
      throw error;
    }
  }

  /**
   * Validiert und normalisiert eine CSV-Zeile
   */
  private validateAndNormalizeRow(row: any, station: string, fileName: string, lineNumber: number): {
    isValid: boolean;
    data?: any;
    error?: string;
  } {
    try {
      // Extrahiere Systemzeit
      let sysTime = row['Systemzeit']?.trim() || row['Systemzeit ']?.trim();
      if (!sysTime) {
        return { isValid: false, error: 'Missing system time' };
      }

      // Normalisiere Zeitformat
      const timeParts = sysTime.split(":");
      if (timeParts.length < 3) {
        return { isValid: false, error: 'Invalid time format' };
      }

      const hours = timeParts[0].padStart(2, "0");
      const minutes = timeParts[1].padStart(2, "0");
      const seconds = timeParts[2].padStart(2, "0");
      sysTime = `${hours}:${minutes}:${seconds}`;

      // Extrahiere Lärmpegel
      const noiseColumns = ["LAF", "LAS", "LAeq", "Lmax", "Lmin"];
      let lasRaw: string | null = null;
      let usedNoiseCol: string | null = null;

      for (const col of noiseColumns) {
        if (row[col] && row[col].trim()) {
          lasRaw = row[col];
          usedNoiseCol = col;
          break;
        }
      }

      if (!lasRaw || !usedNoiseCol) {
        return { isValid: false, error: 'No valid noise level data found' };
      }

      const las = Number(lasRaw.replace(",", "."));
      if (isNaN(las) || las < 0 || las > 200) {
        return { isValid: false, error: `Invalid noise level: ${lasRaw}` };
      }

      // Bestimme Datum
      let dateStr: string | null = null;
      if (row['Datum']) {
        const parts = row['Datum'].split('.');
        if (parts.length === 3) {
          dateStr = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
      } else if (row['Date']) {
        dateStr = row['Date'];
      }

      if (!dateStr) {
        dateStr = new Date().toISOString().split('T')[0];
      }

      const datetime = `${dateStr} ${sysTime}`;

      return {
        isValid: true,
        data: {
          time: datetime,
          las,
          sourceFile: fileName,
          datetime: new Date(datetime).toISOString(),
          allCsvFields: JSON.stringify(row),
          usedNoiseCol
        }
      };

    } catch (error) {
      return { 
        isValid: false, 
        error: `Row validation failed: ${(error as Error).message}` 
      };
    }
  }

  /**
   * Verarbeitet mehrere CSV-Dateien parallel mit Worker-Pool
   */
  async processMultipleFiles(files: Array<{ station: string; path: string; priority?: number }>): Promise<{
    totalProcessed: number;
    totalErrors: number;
    results: Array<{ station: string; file: string; processed: number; errors: number; duration: number }>;
  }> {
    const results: Array<{ station: string; file: string; processed: number; errors: number; duration: number }> = [];
    let totalProcessed = 0;
    let totalErrors = 0;

    // Sortiere nach Priorität
    const sortedFiles = files.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Verarbeite in Batches entsprechend der Worker-Anzahl
    for (let i = 0; i < sortedFiles.length; i += this.config.maxWorkers) {
      const batch = sortedFiles.slice(i, i + this.config.maxWorkers);
      
      const batchPromises = batch.map(async (file) => {
        const result = await this.processCSVFileStreaming(file.station, file.path);
        return {
          station: file.station,
          file: path.basename(file.path),
          ...result
        };
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          totalProcessed += result.value.processed;
          totalErrors += result.value.errors;
        } else {
          console.error('❌ File processing failed:', result.reason);
          totalErrors++;
        }
      });
    }

    return { totalProcessed, totalErrors, results };
  }

  /**
   * Cleanup-Methode
   */
  async cleanup(): Promise<void> {
    // Warte auf alle aktiven Worker
    const workerPromises = Array.from(this.activeWorkers).map(worker => {
      return new Promise<void>((resolve) => {
        worker.terminate().then(() => resolve());
      });
    });

    await Promise.all(workerPromises);
    this.activeWorkers.clear();
    console.log('🧹 StreamingCSVProcessor cleanup completed');
  }
}

// Worker-Thread-Code für parallele Verarbeitung
if (!isMainThread && parentPort) {
  const { station, csvPath, config } = workerData;
  
  parentPort.on('message', async (message) => {
    if (message.type === 'process') {
      try {
        const processor = new StreamingCSVProcessor(config);
        const result = await processor.processCSVFileStreaming(station, csvPath);
        parentPort!.postMessage({ type: 'result', data: result });
      } catch (error) {
        parentPort!.postMessage({ type: 'error', error: error.message });
      }
    }
  });
}