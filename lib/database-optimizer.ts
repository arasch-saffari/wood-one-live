import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export class DatabaseOptimizer {
  private db: Database.Database;
  
  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Optimiert die Datenbank für große Datenmengen
   */
  async optimizeForLargeDatasets(): Promise<void> {
    console.log('🔧 Starting database optimization for large datasets...');

    try {
      // 1. Erweiterte Performance-Pragmas
      await this.applyPerformancePragmas();
      
      // 2. Erstelle optimierte Indizes
      await this.createOptimizedIndexes();
      
      // 3. Erstelle Partitionierungs-Views
      await this.createPartitionedViews();
      
      // 4. Erstelle materialisierte Aggregate
      await this.createMaterializedAggregates();
      
      // 5. Cleanup alte Daten
      await this.setupDataRetention();

      console.log('✅ Database optimization completed');
    } catch (error) {
      console.error('❌ Database optimization failed:', error);
      throw error;
    }
  }

  /**
   * Erweiterte Performance-Pragmas für große Datenmengen
   */
  private async applyPerformancePragmas(): Promise<void> {
    const pragmas = [
      'PRAGMA journal_mode = WAL',
      'PRAGMA synchronous = NORMAL',
      'PRAGMA cache_size = -102400', // 100MB Cache
      'PRAGMA temp_store = MEMORY',
      'PRAGMA mmap_size = 268435456', // 256MB Memory-mapped I/O
      'PRAGMA page_size = 4096',
      'PRAGMA wal_autocheckpoint = 1000',
      'PRAGMA optimize',
      // Für Bulk-Inserts
      'PRAGMA defer_foreign_keys = ON',
      'PRAGMA ignore_check_constraints = ON'
    ];

    for (const pragma of pragmas) {
      try {
        this.db.exec(pragma);
        console.log(`✅ Applied: ${pragma}`);
      } catch (error) {
        console.warn(`⚠️  Failed to apply: ${pragma}`, error);
      }
    }
  }

  /**
   * Erstellt optimierte Indizes für verschiedene Query-Patterns
   */
  private async createOptimizedIndexes(): Promise<void> {
    const indexes = [
      // Composite Index für häufige Queries
      `CREATE INDEX IF NOT EXISTS idx_measurements_station_datetime_las 
       ON measurements(station, datetime DESC, las)`,
      
      // Covering Index für Tabellen-Queries
      `CREATE INDEX IF NOT EXISTS idx_measurements_table_query 
       ON measurements(station, datetime DESC) 
       INCLUDE (time, las, source_file)`,
      
      // Index für Zeitbereich-Queries
      `CREATE INDEX IF NOT EXISTS idx_measurements_datetime_range 
       ON measurements(datetime) WHERE datetime >= datetime('now', '-30 days')`,
      
      // Index für Alarm-Queries
      `CREATE INDEX IF NOT EXISTS idx_measurements_high_las 
       ON measurements(station, las, datetime) WHERE las >= 60`,
      
      // Partial Index für aktuelle Daten
      `CREATE INDEX IF NOT EXISTS idx_measurements_recent 
       ON measurements(station, datetime DESC, las) 
       WHERE datetime >= datetime('now', '-7 days')`,
      
      // Index für Aggregationen
      `CREATE INDEX IF NOT EXISTS idx_measurements_hourly_agg 
       ON measurements(station, strftime('%Y-%m-%d %H', datetime), las)`,
      
      // Weather-Indizes
      `CREATE INDEX IF NOT EXISTS idx_weather_time_station 
       ON weather(time, station) INCLUDE (windSpeed, windDir, relHumidity)`,
      
      // Source-File Index für Import-Tracking
      `CREATE INDEX IF NOT EXISTS idx_measurements_source_datetime 
       ON measurements(source_file, datetime)`
    ];

    for (const indexSQL of indexes) {
      try {
        this.db.exec(indexSQL);
        console.log(`✅ Created index: ${indexSQL.split('\n')[0].trim()}`);
      } catch (error) {
        console.warn(`⚠️  Failed to create index:`, error);
      }
    }
  }

  /**
   * Erstellt partitionierte Views für bessere Performance
   */
  private async createPartitionedViews(): Promise<void> {
    // View für aktuelle Daten (letzte 24h)
    this.db.exec(`
      CREATE VIEW IF NOT EXISTS measurements_current AS
      SELECT * FROM measurements 
      WHERE datetime >= datetime('now', '-1 day')
      ORDER BY datetime DESC
    `);

    // View für historische Daten (älter als 7 Tage)
    this.db.exec(`
      CREATE VIEW IF NOT EXISTS measurements_historical AS
      SELECT station, 
             strftime('%Y-%m-%d %H:00:00', datetime) as hour,
             AVG(las) as avg_las,
             MIN(las) as min_las,
             MAX(las) as max_las,
             COUNT(*) as count
      FROM measurements 
      WHERE datetime < datetime('now', '-7 days')
      GROUP BY station, hour
      ORDER BY hour DESC
    `);

    // View für Alarm-Daten
    this.db.exec(`
      CREATE VIEW IF NOT EXISTS measurements_alarms AS
      SELECT m.*, t.alarm_threshold
      FROM measurements m
      JOIN thresholds t ON t.station = m.station
      WHERE m.las >= t.alarm_threshold
        AND (
          (t.from_time <= t.to_time AND 
           time(m.datetime) BETWEEN t.from_time AND t.to_time)
          OR
          (t.from_time > t.to_time AND 
           (time(m.datetime) >= t.from_time OR time(m.datetime) <= t.to_time))
        )
      ORDER BY m.datetime DESC
    `);

    console.log('✅ Created partitioned views');
  }

  /**
   * Erstellt materialisierte Aggregate-Tabellen
   */
  private async createMaterializedAggregates(): Promise<void> {
    // Stündliche Aggregate
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS measurements_hourly_agg (
        station TEXT NOT NULL,
        hour DATETIME NOT NULL,
        avg_las REAL NOT NULL,
        min_las REAL NOT NULL,
        max_las REAL NOT NULL,
        count INTEGER NOT NULL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (station, hour)
      )
    `);

    // Tägliche Aggregate
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS measurements_daily_agg (
        station TEXT NOT NULL,
        date DATE NOT NULL,
        avg_las REAL NOT NULL,
        min_las REAL NOT NULL,
        max_las REAL NOT NULL,
        alarm_count INTEGER NOT NULL,
        total_count INTEGER NOT NULL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (station, date)
      )
    `);

    // Indizes für Aggregate
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_hourly_agg_station_hour 
      ON measurements_hourly_agg(station, hour DESC)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_daily_agg_station_date 
      ON measurements_daily_agg(station, date DESC)
    `);

    console.log('✅ Created materialized aggregate tables');
  }

  /**
   * Aktualisiert stündliche Aggregate (für Cron-Job)
   */
  async updateHourlyAggregates(): Promise<void> {
    try {
      // Prüfe ob die Tabelle existiert
      const tableExists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='measurements_hourly_agg'
      `).get();
      
      if (!tableExists) {
        console.log('⚠️  measurements_hourly_agg table does not exist, skipping hourly aggregates update');
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO measurements_hourly_agg 
        (station, hour, avg_las, min_las, max_las, count, last_updated)
        SELECT 
          station,
          strftime('%Y-%m-%d %H:00:00', datetime) as hour,
          AVG(las) as avg_las,
          MIN(las) as min_las,
          MAX(las) as max_las,
          COUNT(*) as count,
          CURRENT_TIMESTAMP
        FROM measurements
        WHERE datetime >= datetime('now', '-2 hours')
          AND datetime < datetime('now', '-1 hour')
        GROUP BY station, hour
      `;

      this.db.exec(sql);
      console.log('✅ Updated hourly aggregates');
    } catch (error) {
      console.error('❌ Failed to update hourly aggregates:', error);
    }
  }

  /**
   * Aktualisiert tägliche Aggregate (für Cron-Job)
   */
  async updateDailyAggregates(): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO measurements_daily_agg 
      (station, date, avg_las, min_las, max_las, alarm_count, total_count, last_updated)
      SELECT 
        m.station,
        date(m.datetime) as date,
        AVG(m.las) as avg_las,
        MIN(m.las) as min_las,
        MAX(m.las) as max_las,
        COUNT(CASE WHEN m.las >= COALESCE(t.alarm_threshold, 60) THEN 1 END) as alarm_count,
        COUNT(*) as total_count,
        CURRENT_TIMESTAMP
      FROM measurements m
      LEFT JOIN thresholds t ON t.station = m.station
      WHERE date(m.datetime) = date('now', '-1 day')
      GROUP BY m.station, date(m.datetime)
    `;

    this.db.exec(sql);
    console.log('✅ Updated daily aggregates');
  }

  /**
   * Setup für automatische Datenbereinigung
   */
  private async setupDataRetention(): Promise<void> {
    // Erstelle Tabelle für Retention-Policies
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS data_retention_policies (
        table_name TEXT PRIMARY KEY,
        retention_days INTEGER NOT NULL,
        last_cleanup DATETIME,
        enabled BOOLEAN DEFAULT 1
      )
    `);

    // Standard-Retention-Policies
    const policies = [
      { table: 'measurements', days: 90 },
      { table: 'weather', days: 30 },
      { table: 'measurements_hourly_agg', days: 365 },
      { table: 'measurements_daily_agg', days: 1095 } // 3 Jahre
    ];

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO data_retention_policies 
      (table_name, retention_days) VALUES (?, ?)
    `);

    for (const policy of policies) {
      stmt.run(policy.table, policy.days);
    }

    console.log('✅ Setup data retention policies');
  }

  /**
   * Führt Datenbereinigung basierend auf Retention-Policies durch
   */
  async cleanupOldData(): Promise<{ deletedRows: number; tables: string[] }> {
    const policies = this.db.prepare(`
      SELECT table_name, retention_days 
      FROM data_retention_policies 
      WHERE enabled = 1
    `).all() as Array<{ table_name: string; retention_days: number }>;

    let totalDeleted = 0;
    const cleanedTables: string[] = [];

    for (const policy of policies) {
      try {
        const result = this.db.prepare(`
          DELETE FROM ${policy.table_name} 
          WHERE datetime < datetime('now', '-${policy.retention_days} days')
        `).run();

        if (result.changes > 0) {
          totalDeleted += result.changes;
          cleanedTables.push(policy.table_name);
          console.log(`🧹 Cleaned ${result.changes} rows from ${policy.table_name}`);
        }

        // Update last cleanup time
        this.db.prepare(`
          UPDATE data_retention_policies 
          SET last_cleanup = CURRENT_TIMESTAMP 
          WHERE table_name = ?
        `).run(policy.table_name);

      } catch (error) {
        console.error(`❌ Failed to cleanup ${policy.table_name}:`, error);
      }
    }

    // VACUUM nach großen Löschvorgängen
    if (totalDeleted > 10000) {
      console.log('🔧 Running VACUUM after large cleanup...');
      this.db.exec('VACUUM');
    }

    return { deletedRows: totalDeleted, tables: cleanedTables };
  }

  /**
   * Analysiert Datenbank-Performance und gibt Empfehlungen
   */
  async analyzePerformance(): Promise<{
    tableStats: Array<{ table: string; rows: number; size_mb: number }>;
    indexStats: Array<{ index: string; table: string; unique: boolean }>;
    recommendations: string[];
  }> {
    // Tabellen-Statistiken
    const tableStats = this.db.prepare(`
      SELECT 
        name as table_name,
        (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=m.name) as rows,
        (SELECT page_count * page_size / 1024.0 / 1024.0 FROM pragma_page_count(), pragma_page_size()) as size_mb
      FROM sqlite_master m
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).all();

    // Index-Statistiken
    const indexStats = this.db.prepare(`
      SELECT name as index_name, tbl_name as table_name, "unique" as is_unique
      FROM sqlite_master 
      WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    `).all();

    // Generiere Empfehlungen
    const recommendations: string[] = [];
    
    for (const table of tableStats as any[]) {
      if (table.rows > 1000000) {
        recommendations.push(`Consider partitioning table ${table.table_name} (${table.rows} rows)`);
      }
      if (table.size_mb > 1000) {
        recommendations.push(`Table ${table.table_name} is large (${table.size_mb.toFixed(2)} MB) - consider archiving old data`);
      }
    }

    return {
      tableStats: tableStats as any[],
      indexStats: indexStats as any[],
      recommendations
    };
  }

  /**
   * Optimiert die Datenbank durch ANALYZE und VACUUM
   */
  async optimizeDatabase(): Promise<void> {
    console.log('🔧 Running database optimization...');
    
    // Aktualisiere Statistiken
    this.db.exec('ANALYZE');
    
    // Defragmentiere Datenbank
    this.db.exec('VACUUM');
    
    // Optimiere Query-Planer
    this.db.exec('PRAGMA optimize');
    
    console.log('✅ Database optimization completed');
  }
}

// Utility-Funktionen für Performance-Monitoring
export class PerformanceMonitor {
  private static queryTimes: Map<string, number[]> = new Map();

  static startQuery(queryId: string): () => number {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      
      if (!this.queryTimes.has(queryId)) {
        this.queryTimes.set(queryId, []);
      }
      
      const times = this.queryTimes.get(queryId)!;
      times.push(duration);
      
      // Behalte nur die letzten 100 Messungen
      if (times.length > 100) {
        times.shift();
      }
      
      return duration;
    };
  }

  static getQueryStats(queryId: string): {
    avg: number;
    min: number;
    max: number;
    count: number;
  } | null {
    const times = this.queryTimes.get(queryId);
    if (!times || times.length === 0) return null;

    return {
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      count: times.length
    };
  }

  static getAllStats(): Record<string, ReturnType<typeof PerformanceMonitor.getQueryStats>> {
    const stats: Record<string, any> = {};
    
    for (const [queryId] of this.queryTimes) {
      stats[queryId] = this.getQueryStats(queryId);
    }
    
    return stats;
  }

  static clearStats(): void {
    this.queryTimes.clear();
  }
}