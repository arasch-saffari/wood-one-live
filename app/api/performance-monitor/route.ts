import { NextRequest, NextResponse } from 'next/server';
import { PerformanceMonitor, DatabaseOptimizer } from '@/lib/database-optimizer';
import { intelligentCache } from '@/lib/intelligent-cache';
import { csvImportCoordinator } from '@/lib/csv-import-coordinator';

// Import with fallbacks
let logger: any = console;
let db: any = null;

try {
  const loggerModule = require('@/lib/logger');
  logger = loggerModule.logger || console;
} catch (error) {
  console.warn('Logger module not available');
}

try {
  db = require('@/lib/database').default;
} catch (error) {
  console.warn('Database not available');
}

/**
 * Performance-Monitoring Dashboard API
 */
async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section') || 'overview';

    switch (section) {
      case 'overview':
        return await getOverviewStats();
      
      case 'database':
        return await getDatabaseStats();
      
      case 'cache':
        return await getCacheStats();
      
      case 'import':
        return await getImportStats();
      
      case 'queries':
        return await getQueryStats();
      
      case 'system':
        return await getSystemStats();
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown section: ${section}`
        }, { status: 400 });
    }

  } catch (error) {
    logger.error({ error }, 'Performance monitor API error');

    return NextResponse.json({
      success: false,
      error: 'Failed to get performance stats',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Übersichts-Statistiken
 */
async function getOverviewStats() {
  const cacheStats = intelligentCache.getStats();
  const importStatus = csvImportCoordinator.getStatus();
  const queryStats = PerformanceMonitor.getAllStats();
  
  // Berechne Gesamt-Performance-Score
  const performanceScore = calculatePerformanceScore({
    cacheHitRate: cacheStats.hitRate,
    avgQueryTime: Object.values(queryStats).reduce((sum: number, stat: any) => 
      sum + (stat?.avg || 0), 0) / Object.keys(queryStats).length || 0,
    importSuccessRate: importStatus.stats.totalJobs > 0 
      ? (importStatus.stats.completedJobs / importStatus.stats.totalJobs) * 100 
      : 100,
    systemLoad: process.cpuUsage().system / 1000000 // Convert to seconds
  });

  return NextResponse.json({
    success: true,
    data: {
      performanceScore,
      summary: {
        cacheHitRate: Math.round(cacheStats.hitRate * 100) / 100,
        totalQueries: cacheStats.hits + cacheStats.misses,
        activeImports: importStatus.activeJobs.length,
        queuedImports: importStatus.queuedJobs.length,
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        uptime: Math.round(process.uptime())
      },
      alerts: await generatePerformanceAlerts()
    }
  });
}

/**
 * Datenbank-Statistiken
 */
async function getDatabaseStats() {
  if (!db) {
    return NextResponse.json({
      success: false,
      error: 'Database not available'
    }, { status: 503 });
  }

  const optimizer = new DatabaseOptimizer(db);
  const analysis = await optimizer.analyzePerformance();
  
  // Zusätzliche DB-Metriken
  const dbStats = {
    ...analysis,
    connectionInfo: {
      journalMode: db.pragma('journal_mode', { simple: true }),
      cacheSize: db.pragma('cache_size', { simple: true }),
      pageSize: db.pragma('page_size', { simple: true }),
      synchronous: db.pragma('synchronous', { simple: true })
    },
    recentQueries: PerformanceMonitor.getAllStats()
  };

  return NextResponse.json({
    success: true,
    data: dbStats
  });
}

/**
 * Cache-Statistiken
 */
async function getCacheStats() {
  const stats = intelligentCache.getStats();
  
  return NextResponse.json({
    success: true,
    data: {
      ...stats,
      efficiency: {
        hitRate: Math.round(stats.hitRate * 100) / 100,
        missRate: Math.round((100 - stats.hitRate) * 100) / 100,
        avgHitsPerEntry: Math.round(stats.avgHitsPerEntry * 100) / 100
      },
      memory: {
        usageMB: Math.round(stats.memoryUsage / 1024 / 1024 * 100) / 100,
        entriesCount: stats.size
      },
      topKeys: stats.topKeys
    }
  });
}

/**
 * Import-Statistiken
 */
async function getImportStats() {
  const status = csvImportCoordinator.getStatus();
  
  const successRate = status.stats.totalJobs > 0 
    ? (status.stats.completedJobs / status.stats.totalJobs) * 100 
    : 100;

  const avgProcessingRate = status.stats.avgProcessingTime > 0
    ? Math.round(60000 / status.stats.avgProcessingTime) // Dateien pro Minute
    : 0;

  return NextResponse.json({
    success: true,
    data: {
      ...status,
      metrics: {
        successRate: Math.round(successRate * 100) / 100,
        avgProcessingRate,
        totalRowsProcessed: status.stats.totalProcessed,
        errorRate: status.stats.totalJobs > 0 
          ? Math.round((status.stats.totalErrors / status.stats.totalProcessed) * 10000) / 100
          : 0
      }
    }
  });
}

/**
 * Query-Performance-Statistiken
 */
async function getQueryStats() {
  const stats = PerformanceMonitor.getAllStats();
  
  const sortedStats = Object.entries(stats)
    .map(([queryId, stat]) => ({
      queryId,
      ...stat,
      efficiency: stat ? calculateQueryEfficiency(stat) : 'unknown'
    }))
    .sort((a, b) => (b.avg || 0) - (a.avg || 0));

  return NextResponse.json({
    success: true,
    data: {
      queries: sortedStats,
      summary: {
        totalQueries: Object.keys(stats).length,
        slowQueries: sortedStats.filter(q => (q.avg || 0) > 1000).length,
        avgResponseTime: sortedStats.reduce((sum, q) => sum + (q.avg || 0), 0) / sortedStats.length || 0
      }
    }
  });
}

/**
 * System-Statistiken
 */
async function getSystemStats() {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return NextResponse.json({
    success: true,
    data: {
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000),
        system: Math.round(cpuUsage.system / 1000)
      },
      process: {
        uptime: Math.round(process.uptime()),
        pid: process.pid,
        version: process.version,
        platform: process.platform
      },
      system: {
        cpuCount: require('os').cpus().length,
        totalMemory: Math.round(require('os').totalmem() / 1024 / 1024),
        freeMemory: Math.round(require('os').freemem() / 1024 / 1024),
        loadAverage: require('os').loadavg()
      }
    }
  });
}

/**
 * Berechnet Performance-Score (0-100)
 */
function calculatePerformanceScore(metrics: {
  cacheHitRate: number;
  avgQueryTime: number;
  importSuccessRate: number;
  systemLoad: number;
}): number {
  let score = 100;
  
  // Cache Hit Rate (30% Gewichtung)
  if (metrics.cacheHitRate < 80) score -= (80 - metrics.cacheHitRate) * 0.3;
  
  // Query Performance (25% Gewichtung)
  if (metrics.avgQueryTime > 100) score -= Math.min(25, (metrics.avgQueryTime - 100) / 40);
  
  // Import Success Rate (25% Gewichtung)
  if (metrics.importSuccessRate < 95) score -= (95 - metrics.importSuccessRate) * 0.25;
  
  // System Load (20% Gewichtung)
  if (metrics.systemLoad > 0.8) score -= (metrics.systemLoad - 0.8) * 25;
  
  return Math.max(0, Math.round(score));
}

/**
 * Berechnet Query-Effizienz
 */
function calculateQueryEfficiency(stat: { avg: number; min: number; max: number; count: number }): string {
  if (stat.avg < 50) return 'excellent';
  if (stat.avg < 200) return 'good';
  if (stat.avg < 500) return 'fair';
  if (stat.avg < 1000) return 'poor';
  return 'critical';
}

/**
 * Generiert Performance-Alerts
 */
async function generatePerformanceAlerts(): Promise<Array<{
  type: 'warning' | 'error' | 'info';
  message: string;
  metric: string;
  value: number | string;
}>> {
  const alerts = [];
  
  // Cache-Alerts
  const cacheStats = intelligentCache.getStats();
  if (cacheStats.hitRate < 70) {
    alerts.push({
      type: 'warning' as const,
      message: 'Low cache hit rate detected',
      metric: 'cacheHitRate',
      value: Math.round(cacheStats.hitRate * 100) / 100
    });
  }
  
  // Memory-Alerts
  const memUsage = process.memoryUsage();
  const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  if (heapUsagePercent > 85) {
    alerts.push({
      type: 'error' as const,
      message: 'High memory usage detected',
      metric: 'heapUsage',
      value: Math.round(heapUsagePercent)
    });
  }
  
  // Query-Performance-Alerts
  const queryStats = PerformanceMonitor.getAllStats();
  const slowQueries = Object.entries(queryStats).filter(([_, stat]) => (stat?.avg || 0) > 1000);
  if (slowQueries.length > 0) {
    alerts.push({
      type: 'warning' as const,
      message: `${slowQueries.length} slow queries detected`,
      metric: 'slowQueries',
      value: slowQueries.length
    });
  }
  
  // Import-Alerts
  const importStatus = csvImportCoordinator.getStatus();
  if (importStatus.stats.failedJobs > 0) {
    alerts.push({
      type: 'error' as const,
      message: 'Failed import jobs detected',
      metric: 'failedImports',
      value: importStatus.stats.failedJobs
    });
  }
  
  return alerts;
}

/**
 * Optimierungsaktionen
 */
async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'clearCache':
        await intelligentCache.clear();
        return NextResponse.json({
          success: true,
          data: { message: 'Cache cleared successfully' }
        });

      case 'optimizeDatabase':
        if (!db) {
          return NextResponse.json({
            success: false,
            error: 'Database not available'
          }, { status: 503 });
        }
        
        const optimizer = new DatabaseOptimizer(db);
        await optimizer.optimizeDatabase();
        
        return NextResponse.json({
          success: true,
          data: { message: 'Database optimized successfully' }
        });

      case 'clearQueryStats':
        PerformanceMonitor.clearStats();
        
        return NextResponse.json({
          success: true,
          data: { message: 'Query statistics cleared successfully' }
        });

      case 'warmupCache':
        const { warmupTableDataCache } = require('@/lib/table-data-service');
        await warmupCache();
        
        return NextResponse.json({
          success: true,
          data: { message: 'Cache warmup completed successfully' }
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }

  } catch (error) {
    logger.error({ error }, 'Performance monitor action error');

    return NextResponse.json({
      success: false,
      error: 'Action failed',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
    }, { status: 500 });
  }
}

export { GET, POST };