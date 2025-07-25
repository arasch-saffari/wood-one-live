import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
// Import with fallbacks for missing dependencies
let DatabaseService: any = null;
let logger: any = console;
let ImportError: any = Error;
let ValidationError: any = Error;
let TimeUtils: any = null;
let CacheService: any = null;
let config: any = {};

try {
  const dbModule = require('./database');
  DatabaseService = dbModule.DatabaseService;
} catch (error) {
  console.warn('Database service not available');
}

try {
  const loggerModule = require('./logger');
  logger = loggerModule.logger;
  ImportError = loggerModule.ImportError || Error;
  ValidationError = loggerModule.ValidationError || Error;
} catch (error) {
  console.warn('Logger module not available, using console');
}

try {
  const timeModule = require('./time-utils');
  TimeUtils = timeModule.TimeUtils;
} catch (error) {
  console.warn('Time utils not available');
  // Fallback TimeUtils
  TimeUtils = {
    nowUtc: () => new Date().toISOString(),
    toUtcIso: (date: any) => new Date(date).toISOString(),
    isValidDate: (dateString: string) => !isNaN(new Date(dateString).getTime())
  };
}

try {
  const cacheModule = require('./cache');
  CacheService = cacheModule.CacheService;
} catch (error) {
  console.warn('Cache service not available');
  // Fallback CacheService
  CacheService = {
    del: () => {},
    set: () => {},
    get: () => null
  };
}

try {
  const configModule = require('./config');
  config = configModule.config || {};
} catch (error) {
  console.warn('Config module not available');
}

interface CSVProcessingResult {
  insertedCount: number;
  skippedCount: number;
  errorCount: number;
  duration: number;
  fileName: string;
}

interface CSVMetadata {
  lastLine: number;
  lastProcessed: string;
  checksum?: string;
}

export class CSVProcessor {
  private static readonly BATCH_SIZE = 100;
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly SUPPORTED_NOISE_COLUMNS = [
    "LAF", "LAS", "LAeq", "Lmax", "Lmin", "LAFT5s", "LAFTeq", "LAF5s", "LCFeq", "LCF5s"
  ];

  /**
   * Get metadata file path for a CSV file
   */
  private static getMetaPath(csvPath: string): string {
    return csvPath + '.meta.json';
  }

  /**
   * Read processing metadata for a CSV file
   */
  private static readMetadata(csvPath: string): CSVMetadata {
    const metaPath = this.getMetaPath(csvPath);
    
    if (fs.existsSync(metaPath)) {
      try {
        const content = fs.readFileSync(metaPath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        logger.warn({ error, metaPath }, 'Failed to read CSV metadata, starting fresh');
      }
    }
    
    return { 
      lastLine: 0, 
      lastProcessed: TimeUtils.nowUtc() 
    };
  }

  /**
   * Write processing metadata for a CSV file
   */
  private static writeMetadata(csvPath: string, meta: CSVMetadata): void {
    const metaPath = this.getMetaPath(csvPath);
    
    try {
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    } catch (error) {
      logger.error({ error, metaPath }, 'Failed to write CSV metadata');
    }
  }

  /**
   * Write metadata with fsync for crash safety
   */
  private static writeMetadataSync(csvPath: string, meta: CSVMetadata): void {
    const metaPath = this.getMetaPath(csvPath);
    
    try {
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
      const fd = fs.openSync(metaPath, 'r');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
    } catch (error) {
      logger.error({ error, metaPath }, 'Failed to write CSV metadata with sync');
    }
  }

  /**
   * Validate and normalize CSV row data
   */
  private static validateAndNormalizeRow(row: any, station: string, fileName: string): {
    isValid: boolean;
    normalizedData?: {
      datetime: string;
      time: string;
      las: number;
      usedNoiseCol: string;
      allCsvFields: string;
    };
    error?: string;
  } {
    try {
      // Extract and validate system time
      let sysTime = row['Systemzeit']?.trim() || row['Systemzeit ']?.trim();
      if (!sysTime) {
        return { isValid: false, error: 'Missing system time' };
      }

      // Normalize time format
      const timeParts = sysTime.split(":");
      if (timeParts.length < 3) {
        return { isValid: false, error: 'Invalid time format' };
      }

      const hours = timeParts[0].padStart(2, "0");
      const minutes = timeParts[1].padStart(2, "0");
      const seconds = timeParts[2].padStart(2, "0");
      sysTime = `${hours}:${minutes}:${seconds}`;

      // Extract noise level data
      let lasRaw: string | null = null;
      let usedNoiseCol: string | null = null;

      for (const col of this.SUPPORTED_NOISE_COLUMNS) {
        if (row[col] && row[col].trim()) {
          lasRaw = row[col];
          usedNoiseCol = col;
          break;
        }
      }

      if (!lasRaw || !usedNoiseCol) {
        return { isValid: false, error: 'No valid noise level data found' };
      }

      // Parse noise level
      const las = Number(lasRaw.replace(",", "."));
      if (isNaN(las) || las < 0 || las > 200) {
        return { isValid: false, error: `Invalid noise level: ${lasRaw}` };
      }

      // Determine date
      let dateStr: string | null = null;

      if (row['Datum']) {
        const parts = row['Datum'].split('.');
        if (parts.length === 3) {
          dateStr = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
      } else if (row['Date']) {
        dateStr = row['Date'];
      } else if (row['datetime']) {
        const dt = new Date(row['datetime']);
        if (!isNaN(dt.getTime())) {
          dateStr = dt.toISOString().split('T')[0];
        }
      }

      // Fallback to file modification time
      if (!dateStr) {
        logger.warn({ fileName, station }, 'No date found in CSV row, using current date');
        dateStr = TimeUtils.nowUtc().split('T')[0];
      }

      const datetime = `${dateStr} ${sysTime}`;
      
      // Validate datetime
      if (!TimeUtils.isValidDate(datetime)) {
        return { isValid: false, error: `Invalid datetime: ${datetime}` };
      }

      // Store additional metadata
      row['_usedNoiseCol'] = usedNoiseCol;
      row['_noiseValue'] = las.toString();
      row['_fullDateTime'] = datetime;
      row['_processedAt'] = TimeUtils.nowUtc();

      return {
        isValid: true,
        normalizedData: {
          datetime: TimeUtils.toUtcIso(datetime),
          time: datetime,
          las,
          usedNoiseCol,
          allCsvFields: JSON.stringify(row)
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
   * Process a single CSV file with improved error handling and performance
   */
  static async processCSVFile(station: string, csvPath: string): Promise<CSVProcessingResult> {
    const startTime = Date.now();
    const fileName = path.basename(csvPath);
    
    logger.info({ station, csvPath, fileName }, 'Starting CSV file processing');

    if (!fs.existsSync(csvPath)) {
      throw new ImportError(`CSV file not found: ${csvPath}`);
    }

    const fileStat = fs.statSync(csvPath);
    const metadata = this.readMetadata(csvPath);
    
    let attempts = 0;
    
    while (attempts < this.MAX_ATTEMPTS) {
      attempts++;
      
      try {
        const result = await this.processSingleAttempt(
          station, 
          csvPath, 
          fileName, 
          metadata, 
          fileStat
        );
        
        const duration = Date.now() - startTime;
        
        logger.info({
          station,
          fileName,
          result,
          duration,
          attempts
        }, 'CSV file processing completed successfully');

        return {
          ...result,
          duration,
          fileName
        };

      } catch (error) {
        logger.warn({
          station,
          fileName,
          attempt: attempts,
          maxAttempts: this.MAX_ATTEMPTS,
          error
        }, 'CSV processing attempt failed');

        if (attempts >= this.MAX_ATTEMPTS) {
          const duration = Date.now() - startTime;
          logger.error({
            station,
            fileName,
            attempts,
            duration,
            error
          }, 'All CSV processing attempts failed');
          
          throw new ImportError(
            `Failed to process CSV file after ${attempts} attempts: ${fileName}`,
            { station, fileName, error }
          );
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    throw new ImportError('Unexpected error in CSV processing loop');
  }

  /**
   * Single processing attempt with transaction handling
   */
  private static async processSingleAttempt(
    station: string,
    csvPath: string,
    fileName: string,
    metadata: CSVMetadata,
    fileStat: fs.Stats
  ): Promise<{ insertedCount: number; skippedCount: number; errorCount: number }> {
    
    let currentLine = 0;
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let batchCount = 0;

    const lastLine = metadata.lastLine || 0;

    return new Promise((resolve, reject) => {
      // Use database transaction for consistency
      DatabaseService.executeTransaction(() => {
        const stream = fs.createReadStream(csvPath)
          .pipe(csvParser({ 
            separator: ';', 
            skipLines: lastLine,
            mapHeaders: ({ header }) => header.trim()
          }));

        stream.on('data', (row) => {
          currentLine++;
          batchCount++;
          const realLine = lastLine + currentLine;

          try {
            const validation = this.validateAndNormalizeRow(row, station, fileName);
            
            if (!validation.isValid) {
              logger.debug({
                station,
                fileName,
                line: realLine,
                error: validation.error
              }, 'Skipping invalid CSV row');
              skippedCount++;
              return;
            }

            const { normalizedData } = validation;

            // Insert with retry logic for database locks
            let insertSuccess = false;
            for (let dbAttempt = 1; dbAttempt <= 5; dbAttempt++) {
              try {
                const result = DatabaseService.executeQuerySingle<{ changes: number }>(
                  'INSERT OR REPLACE INTO measurements (station, time, las, source_file, datetime, all_csv_fields) VALUES (?, ?, ?, ?, ?, ?)',
                  [station, normalizedData.time, normalizedData.las, fileName, normalizedData.datetime, normalizedData.allCsvFields]
                );

                if (result && result.changes > 0) {
                  insertedCount++;
                }
                insertSuccess = true;
                break;

              } catch (dbError: any) {
                if (dbError.code === 'SQLITE_BUSY' && dbAttempt < 5) {
                  logger.debug({
                    station,
                    fileName,
                    line: realLine,
                    attempt: dbAttempt
                  }, 'Database busy, retrying...');
                  
                  // Wait with exponential backoff
                  const waitTime = 100 * Math.pow(2, dbAttempt - 1);
                  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitTime);
                  continue;
                } else {
                  throw dbError;
                }
              }
            }

            if (!insertSuccess) {
              errorCount++;
              logger.warn({
                station,
                fileName,
                line: realLine
              }, 'Failed to insert row after all database attempts');
            }

            // Batch metadata updates for performance
            if (batchCount >= this.BATCH_SIZE) {
              this.writeMetadata(csvPath, { 
                lastLine: realLine,
                lastProcessed: TimeUtils.nowUtc()
              });
              batchCount = 0;
            }

          } catch (rowError) {
            errorCount++;
            logger.warn({
              station,
              fileName,
              line: realLine,
              error: rowError
            }, 'Error processing CSV row');
          }
        });

        stream.on('end', () => {
          try {
            // Final metadata update with fsync for crash safety
            if (currentLine > 0) {
              this.writeMetadataSync(csvPath, {
                lastLine: lastLine + currentLine,
                lastProcessed: TimeUtils.nowUtc()
              });
            }

            // Clear cache for this station
            this.clearStationCache(station);

            resolve({ insertedCount, skippedCount, errorCount });

          } catch (endError) {
            reject(endError);
          }
        });

        stream.on('error', (streamError) => {
          reject(new ImportError(`CSV stream error: ${streamError.message}`, {
            station,
            fileName,
            error: streamError
          }));
        });
      });
    });
  }

  /**
   * Clear cached data for a station after successful import
   */
  private static clearStationCache(station: string): void {
    try {
      // Clear file-based cache
      const cacheFile = path.join(process.cwd(), 'cache', `stationdata-${station}.json`);
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
      }

      // Clear memory cache
      CacheService.del(`station_${station}`);
      CacheService.del(`measurements_${station}`);
      
      logger.debug({ station }, 'Station cache cleared');
    } catch (error) {
      logger.warn({ error, station }, 'Failed to clear station cache');
    }
  }

  /**
   * Process all CSV files for all stations
   */
  static async processAllCSVFiles(): Promise<{
    totalInserted: number;
    totalSkipped: number;
    totalErrors: number;
    stationResults: Record<string, CSVProcessingResult[]>;
  }> {
    const stations = ['ort', 'techno', 'heuballern', 'band'];
    const stationResults: Record<string, CSVProcessingResult[]> = {};
    
    logger.info({ stations }, 'Starting CSV processing for all stations');

    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Process stations in parallel for better performance
    const results = await Promise.allSettled(
      stations.map(async (station) => {
        const csvDir = path.join(process.cwd(), "public", "csv", station);
        
        logger.info({ station, csvDir }, 'Processing station CSV directory');

        if (!fs.existsSync(csvDir)) {
          logger.warn({ station, csvDir }, 'CSV directory does not exist');
          return { station, results: [] };
        }

        const csvFiles = fs.readdirSync(csvDir)
          .filter(file => file.endsWith('.csv'))
          .sort(); // Process files in consistent order

        logger.info({ station, fileCount: csvFiles.length }, 'Found CSV files for station');

        const stationFileResults: CSVProcessingResult[] = [];

        // Process files sequentially within each station to avoid conflicts
        for (const csvFile of csvFiles) {
          const csvPath = path.join(csvDir, csvFile);
          
          try {
            const result = await this.processCSVFile(station, csvPath);
            stationFileResults.push(result);
            
            logger.info({
              station,
              fileName: csvFile,
              inserted: result.insertedCount,
              skipped: result.skippedCount,
              errors: result.errorCount
            }, 'CSV file processed successfully');

          } catch (error) {
            logger.error({
              station,
              fileName: csvFile,
              error
            }, 'Failed to process CSV file');
            
            stationFileResults.push({
              fileName: csvFile,
              insertedCount: 0,
              skippedCount: 0,
              errorCount: 1,
              duration: 0
            });
          }
        }

        return { station, results: stationFileResults };
      })
    );

    // Aggregate results
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { station, results: fileResults } = result.value;
        stationResults[station] = fileResults;
        
        fileResults.forEach(fileResult => {
          totalInserted += fileResult.insertedCount;
          totalSkipped += fileResult.skippedCount;
          totalErrors += fileResult.errorCount;
        });
      } else {
        logger.error({ error: result.reason }, 'Station processing failed');
        totalErrors++;
      }
    });

    logger.info({
      totalInserted,
      totalSkipped,
      totalErrors,
      stationsProcessed: Object.keys(stationResults).length
    }, 'CSV processing completed for all stations');

    return {
      totalInserted,
      totalSkipped,
      totalErrors,
      stationResults
    };
  }
}

// CLI support
if (require.main === module) {
  CSVProcessor.processAllCSVFiles()
    .then(result => {
      console.log(`✅ CSV import completed. Inserted: ${result.totalInserted}, Skipped: ${result.totalSkipped}, Errors: ${result.totalErrors}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ CSV import failed:', error);
      process.exit(1);
    });
}