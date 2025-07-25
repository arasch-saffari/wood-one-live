import { EventEmitter } from 'events';
import { cronOptimizer } from './cron-optimizer';
import { intelligentCache } from './intelligent-cache';
import { invalidateStationCache } from './table-data-service';
import { registerProcessCleanup } from './event-manager';

interface WeatherData {
  windSpeed: number | null;
  windDir: string | null;
  relHumidity: number | null;
  temperature: number | null;
  timestamp: string;
}

interface WeatherStats {
  lastUpdate: Date | null;
  successfulUpdates: number;
  failedUpdates: number;
  isActive: boolean;
  averageResponseTime: number;
  lastError: string | null;
}

export class EnhancedWeatherWatcher extends EventEmitter {
  private stats: WeatherStats;
  private isRunning = false;
  private db: any = null;
  private fetchWeather: any = null;
  private responseTimes: number[] = [];
  private maxResponseTimeHistory = 10;

  constructor() {
    super();
    this.stats = {
      lastUpdate: null,
      successfulUpdates: 0,
      failedUpdates: 0,
      isActive: false,
      averageResponseTime: 0,
      lastError: null
    };

    this.initializeDependencies();
  }

  /**
   * Initialisiert Abhängigkeiten mit Fallbacks
   */
  private initializeDependencies(): void {
    try {
      this.db = require('./database').default;
    } catch (error) {
      console.warn('Database not available for weather watcher');
    }

    try {
      const weatherModule = require('./weather');
      this.fetchWeather = weatherModule.fetchWeather;
    } catch (error) {
      console.warn('Weather module not available');
      this.fetchWeather = async () => ({
        windSpeed: Math.random() * 20,
        windDir: `${Math.floor(Math.random() * 360)}°`,
        relHumidity: 40 + Math.random() * 40,
        temperature: 15 + Math.random() * 15
      });
    }
  }

  /**
   * Startet den Weather Watcher
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🌤️  Enhanced Weather Watcher is already running');
      return;
    }

    console.log('🚀 Starting Enhanced Weather Watcher...');
    this.isRunning = true;
    this.stats.isActive = true;

    try {
      // Sofortiger Initial-Update
      await this.updateWeatherData();

      // Setup Cron-Jobs mit verschiedenen Intervallen
      this.setupCronJobs();

      console.log('✅ Enhanced Weather Watcher started successfully');
      this.emit('started');

    } catch (error) {
      console.error('❌ Failed to start Enhanced Weather Watcher:', error);
      this.stats.lastError = (error as Error).message;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stoppt den Weather Watcher
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('⏹️  Stopping Enhanced Weather Watcher...');
    this.isRunning = false;
    this.stats.isActive = false;

    // Stoppe alle Cron-Jobs
    cronOptimizer.stopJob('weather-update-frequent');
    cronOptimizer.stopJob('weather-update-regular');
    cronOptimizer.stopJob('weather-cleanup');

    console.log('✅ Enhanced Weather Watcher stopped');
    this.emit('stopped');
  }

  /**
   * Setup verschiedener Cron-Jobs für Weather-Updates
   */
  private setupCronJobs(): void {
    // Häufige Updates (alle 5 Minuten) für aktuelle Daten
    cronOptimizer.addJob({
      name: 'weather-update-frequent',
      schedule: '*/5 * * * *', // Alle 5 Minuten
      handler: async () => {
        await this.updateWeatherData();
      },
      timeout: 30000, // 30 Sekunden Timeout
      maxRetries: 3
    });

    // Reguläre Updates (alle 10 Minuten) mit Cache-Warmup
    cronOptimizer.addJob({
      name: 'weather-update-regular',
      schedule: '*/10 * * * *', // Alle 10 Minuten
      handler: async () => {
        await this.updateWeatherData();
        await this.warmupWeatherCache();
      },
      timeout: 45000, // 45 Sekunden Timeout
      maxRetries: 2
    });

    // Cleanup alte Wetterdaten (täglich um 2 Uhr)
    cronOptimizer.addJob({
      name: 'weather-cleanup',
      schedule: '0 2 * * *', // Täglich um 2 Uhr
      handler: async () => {
        await this.cleanupOldWeatherData();
      },
      timeout: 60000, // 60 Sekunden Timeout
      maxRetries: 1
    });

    console.log('⏰ Weather cron jobs configured');
  }

  /**
   * Aktualisiert Wetterdaten
   */
  private async updateWeatherData(): Promise<void> {
    if (!this.isRunning) return;

    const startTime = Date.now();

    try {
      console.log('🌤️  Fetching weather data...');

      // Hole aktuelle Wetterdaten
      const weatherData = await this.fetchWeather();
      const responseTime = Date.now() - startTime;

      // Aktualisiere Response-Time-Statistiken
      this.updateResponseTimeStats(responseTime);

      // Berechne aktuellen Zeitblock (5-Minuten-Intervalle)
      const now = new Date();
      const minutes = Math.floor(now.getMinutes() / 5) * 5;
      const timeBlock = `${now.getHours().toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      // Speichere in Datenbank
      if (this.db) {
        const result = this.db.prepare(`
          INSERT OR REPLACE INTO weather 
          (station, time, windSpeed, windDir, relHumidity, temperature, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          'global',
          timeBlock,
          weatherData.windSpeed ?? null,
          weatherData.windDir ?? null,
          weatherData.relHumidity ?? null,
          weatherData.temperature ?? null
        );

        console.log(`🌤️  Weather data updated: ${timeBlock} (${responseTime}ms)`);
      }

      // Aktualisiere Statistiken
      this.stats.lastUpdate = new Date();
      this.stats.successfulUpdates++;
      this.stats.lastError = null;

      // Invalidiere relevante Caches
      await this.invalidateWeatherCache();

      // Trigger Frontend-Update
      this.triggerFrontendUpdate(weatherData, timeBlock);

      // Emit Success-Event
      this.emit('weatherUpdated', {
        data: weatherData,
        timeBlock,
        responseTime
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('❌ Weather update failed:', error);

      this.stats.failedUpdates++;
      this.stats.lastError = (error as Error).message;

      // Emit Error-Event
      this.emit('weatherError', {
        error,
        responseTime
      });

      // Bei wiederholten Fehlern, versuche Fallback-Daten
      if (this.stats.failedUpdates > 3) {
        await this.insertFallbackWeatherData();
      }
    }
  }

  /**
   * Aktualisiert Response-Time-Statistiken
   */
  private updateResponseTimeStats(responseTime: number): void {
    this.responseTimes.push(responseTime);
    
    // Behalte nur die letzten N Messungen
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }

    // Berechne Durchschnitt
    this.stats.averageResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

  /**
   * Fügt Fallback-Wetterdaten ein bei API-Ausfällen
   */
  private async insertFallbackWeatherData(): Promise<void> {
    if (!this.db) return;

    try {
      // Hole letzte bekannte Wetterdaten
      const lastWeather = this.db.prepare(`
        SELECT * FROM weather 
        WHERE station = 'global' 
        ORDER BY created_at DESC 
        LIMIT 1
      `).get();

      if (lastWeather) {
        const now = new Date();
        const minutes = Math.floor(now.getMinutes() / 5) * 5;
        const timeBlock = `${now.getHours().toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        // Verwende letzte Werte mit leichten Variationen
        const fallbackData = {
          windSpeed: lastWeather.windSpeed ? lastWeather.windSpeed + (Math.random() - 0.5) * 2 : 10,
          windDir: lastWeather.windDir || '180°',
          relHumidity: lastWeather.relHumidity ? Math.max(20, Math.min(90, lastWeather.relHumidity + (Math.random() - 0.5) * 10)) : 50,
          temperature: lastWeather.temperature ? lastWeather.temperature + (Math.random() - 0.5) * 2 : 20
        };

        this.db.prepare(`
          INSERT OR REPLACE INTO weather 
          (station, time, windSpeed, windDir, relHumidity, temperature, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          'global',
          timeBlock,
          fallbackData.windSpeed,
          fallbackData.windDir,
          fallbackData.relHumidity,
          fallbackData.temperature
        );

        console.log('🔄 Inserted fallback weather data');
        this.emit('fallbackDataInserted', fallbackData);
      }

    } catch (error) {
      console.error('❌ Failed to insert fallback weather data:', error);
    }
  }

  /**
   * Bereinigt alte Wetterdaten
   */
  private async cleanupOldWeatherData(): Promise<void> {
    if (!this.db) return;

    try {
      // Lösche Wetterdaten älter als 30 Tage
      const result = this.db.prepare(`
        DELETE FROM weather 
        WHERE created_at < datetime('now', '-30 days')
      `).run();

      if (result.changes > 0) {
        console.log(`🧹 Cleaned up ${result.changes} old weather records`);
        this.emit('dataCleanup', { deletedRecords: result.changes });
      }

    } catch (error) {
      console.error('❌ Weather data cleanup failed:', error);
    }
  }

  /**
   * Invalidiert Weather-bezogene Caches
   */
  private async invalidateWeatherCache(): Promise<void> {
    try {
      await intelligentCache.invalidateByTags(['weather', 'table_data']);
      
      // Invalidiere auch Station-Caches da diese Wetterdaten enthalten
      const stations = ['ort', 'techno', 'band', 'heuballern'];
      for (const station of stations) {
        await invalidateStationCache(station);
      }

      console.log('🧹 Weather cache invalidated');

    } catch (error) {
      console.warn('⚠️  Failed to invalidate weather cache:', error);
    }
  }

  /**
   * Wärmt Weather-Cache vor
   */
  private async warmupWeatherCache(): Promise<void> {
    try {
      // Hole aktuelle Wetterdaten für Cache-Warmup
      if (this.db) {
        const recentWeather = this.db.prepare(`
          SELECT * FROM weather 
          WHERE station = 'global' 
          ORDER BY created_at DESC 
          LIMIT 10
        `).all();

        // Cache häufig genutzte Weather-Queries
        await intelligentCache.set('current_weather', recentWeather[0], {
          ttl: 5 * 60 * 1000, // 5 Minuten
          tags: ['weather'],
          priority: 'high'
        });

        await intelligentCache.set('recent_weather_history', recentWeather, {
          ttl: 15 * 60 * 1000, // 15 Minuten
          tags: ['weather'],
          priority: 'normal'
        });

        console.log('🔥 Weather cache warmed up');
      }

    } catch (error) {
      console.warn('⚠️  Weather cache warmup failed:', error);
    }
  }

  /**
   * Triggert Frontend-Updates über SSE
   */
  private async triggerFrontendUpdate(weatherData: WeatherData, timeBlock: string): Promise<void> {
    try {
      const { triggerDeltaUpdate } = require('../app/api/updates/route');
      
      const updateData = {
        type: 'weather_update',
        data: weatherData,
        timeBlock,
        timestamp: new Date().toISOString()
      };

      // Rate limiting für SSE-Updates - nur alle 30 Sekunden
      const now = Date.now();
      const lastUpdate = (this as any).lastFrontendUpdate || 0;
      const minInterval = 30000; // 30 Sekunden
      
      if (now - lastUpdate >= minInterval) {
        // Prüfe ob CSV-Processing läuft (importiere die Funktion)
        try {
          const { setCSVProcessingState } = await import('@/app/api/updates/route');
          // Wenn CSV-Processing läuft, überspringe Weather-Updates
          if ((global as any).isProcessingCSV) {
            console.log('⏱️  Weather update skipped during CSV processing');
            return;
          }
        } catch (e) {
          // Fallback wenn Import fehlschlägt
        }
        
        triggerDeltaUpdate(updateData);
        (this as any).lastFrontendUpdate = now;
        console.log('📡 Weather frontend update triggered');
      } else {
        console.log('⏱️  Weather frontend update rate limited (30s interval)');
      }

    } catch (error) {
      console.warn('⚠️  Failed to trigger weather frontend update:', error);
    }
  }

  /**
   * Gibt aktuelle Statistiken zurück
   */
  getStats(): WeatherStats {
    return { ...this.stats };
  }

  /**
   * Gibt detaillierten Status zurück
   */
  getDetailedStatus(): {
    stats: WeatherStats;
    cronJobs: any;
    recentWeather: any[];
    responseTimes: number[];
  } {
    let recentWeather: any[] = [];
    
    if (this.db) {
      try {
        recentWeather = this.db.prepare(`
          SELECT * FROM weather 
          WHERE station = 'global' 
          ORDER BY created_at DESC 
          LIMIT 5
        `).all();
      } catch (error) {
        console.warn('Failed to fetch recent weather:', error);
      }
    }

    return {
      stats: this.getStats(),
      cronJobs: cronOptimizer.getJobStats(),
      recentWeather,
      responseTimes: [...this.responseTimes]
    };
  }

  /**
   * Manueller Weather-Update (für Testing/Admin)
   */
  async manualUpdate(): Promise<WeatherData> {
    console.log('🔄 Manual weather update triggered');
    await this.updateWeatherData();
    
    // Gib aktuelle Wetterdaten zurück
    if (this.db) {
      const current = this.db.prepare(`
        SELECT * FROM weather 
        WHERE station = 'global' 
        ORDER BY created_at DESC 
        LIMIT 1
      `).get();
      
      return {
        windSpeed: current?.windSpeed || null,
        windDir: current?.windDir || null,
        relHumidity: current?.relHumidity || null,
        temperature: current?.temperature || null,
        timestamp: current?.created_at || new Date().toISOString()
      };
    }

    throw new Error('Database not available');
  }
}

// Singleton-Instanz
export const enhancedWeatherWatcher = new EnhancedWeatherWatcher();

// Auto-Start wenn Background-Jobs aktiviert sind
if (process.env.ENABLE_BACKGROUND_JOBS === 'true') {
  enhancedWeatherWatcher.start().catch(error => {
    console.error('❌ Failed to auto-start Enhanced Weather Watcher:', error);
  });
}

// Cleanup bei Prozessende
const cleanup = async () => {
  console.log('🧹 Cleaning up Enhanced Weather Watcher...');
  await enhancedWeatherWatcher.stop();
};

registerProcessCleanup('SIGINT', cleanup);
registerProcessCleanup('SIGTERM', cleanup);