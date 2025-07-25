import { NextRequest, NextResponse } from 'next/server';
import { enhancedCSVWatcher } from '@/lib/enhanced-csv-watcher';
import { enhancedWeatherWatcher } from '@/lib/enhanced-weather-watcher';
import { csvImportCoordinator } from '@/lib/csv-import-coordinator';
import { intelligentCache } from '@/lib/intelligent-cache';

// Import with fallbacks
let logger: any = console;

try {
  const loggerModule = require('@/lib/logger');
  logger = loggerModule.logger || console;
} catch (error) {
  console.warn('Logger module not available');
}

/**
 * Watcher-Management API
 */
async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'status';
    const watcher = searchParams.get('watcher'); // 'csv', 'weather', 'all'

    switch (action) {
      case 'status':
        return await getWatcherStatus(watcher);
      
      case 'detailed':
        return await getDetailedStatus(watcher);
      
      case 'stats':
        return await getWatcherStats(watcher);
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }

  } catch (error) {
    logger.error({ error }, 'Watcher management API error');

    return NextResponse.json({
      success: false,
      error: 'Failed to get watcher status',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Watcher-Steuerung (Start/Stop/Restart)
 */
async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, watcher } = body;

    logger.info({ action, watcher }, 'Watcher management action received');

    switch (action) {
      case 'start':
        return await startWatcher(watcher);
      
      case 'stop':
        return await stopWatcher(watcher);
      
      case 'restart':
        return await restartWatcher(watcher);
      
      case 'manual-update':
        return await manualUpdate(watcher);
      
      case 'clear-cache':
        return await clearWatcherCache(watcher);
      
      case 'force-import':
        return await forceImport();
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }

  } catch (error) {
    logger.error({ error }, 'Watcher management action error');

    return NextResponse.json({
      success: false,
      error: 'Action failed',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Gibt Watcher-Status zurück
 */
async function getWatcherStatus(watcher: string | null) {
  const status: any = {
    timestamp: new Date().toISOString()
  };

  if (!watcher || watcher === 'all' || watcher === 'csv') {
    status.csvWatcher = {
      isActive: enhancedCSVWatcher.getStats().isActive,
      stats: enhancedCSVWatcher.getStats(),
      importQueue: csvImportCoordinator.getStatus().stats
    };
  }

  if (!watcher || watcher === 'all' || watcher === 'weather') {
    status.weatherWatcher = {
      isActive: enhancedWeatherWatcher.getStats().isActive,
      stats: enhancedWeatherWatcher.getStats()
    };
  }

  if (!watcher || watcher === 'all') {
    status.system = {
      backgroundJobsEnabled: process.env.ENABLE_BACKGROUND_JOBS === 'true',
      nodeEnv: process.env.NODE_ENV,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  return NextResponse.json({
    success: true,
    data: status
  });
}

/**
 * Gibt detaillierten Status zurück
 */
async function getDetailedStatus(watcher: string | null) {
  const status: any = {
    timestamp: new Date().toISOString()
  };

  if (!watcher || watcher === 'all' || watcher === 'csv') {
    status.csvWatcher = enhancedCSVWatcher.getDetailedStatus();
  }

  if (!watcher || watcher === 'all' || watcher === 'weather') {
    status.weatherWatcher = enhancedWeatherWatcher.getDetailedStatus();
  }

  if (!watcher || watcher === 'all') {
    status.cache = intelligentCache.getStats();
    status.importCoordinator = csvImportCoordinator.getStatus();
  }

  return NextResponse.json({
    success: true,
    data: status
  });
}

/**
 * Gibt Watcher-Statistiken zurück
 */
async function getWatcherStats(watcher: string | null) {
  const stats: any = {};

  if (!watcher || watcher === 'all' || watcher === 'csv') {
    const csvStats = enhancedCSVWatcher.getStats();
    const importStats = csvImportCoordinator.getStatus().stats;
    
    stats.csv = {
      ...csvStats,
      import: importStats,
      efficiency: {
        successRate: importStats.totalJobs > 0 
          ? ((importStats.completedJobs / importStats.totalJobs) * 100).toFixed(2) + '%'
          : '100%',
        avgProcessingTime: importStats.avgProcessingTime || 0,
        filesPerHour: importStats.avgProcessingTime > 0 
          ? Math.round(3600000 / importStats.avgProcessingTime)
          : 0
      }
    };
  }

  if (!watcher || watcher === 'all' || watcher === 'weather') {
    const weatherStats = enhancedWeatherWatcher.getStats();
    
    stats.weather = {
      ...weatherStats,
      efficiency: {
        successRate: weatherStats.successfulUpdates + weatherStats.failedUpdates > 0
          ? ((weatherStats.successfulUpdates / (weatherStats.successfulUpdates + weatherStats.failedUpdates)) * 100).toFixed(2) + '%'
          : '100%',
        avgResponseTime: weatherStats.averageResponseTime || 0,
        updatesPerHour: weatherStats.successfulUpdates > 0 ? 12 : 0 // 5-Minuten-Intervall = 12/Stunde
      }
    };
  }

  return NextResponse.json({
    success: true,
    data: stats
  });
}

/**
 * Startet einen Watcher
 */
async function startWatcher(watcher: string) {
  const results: any = {};

  try {
    if (watcher === 'csv' || watcher === 'all') {
      await enhancedCSVWatcher.start();
      results.csvWatcher = 'started';
    }

    if (watcher === 'weather' || watcher === 'all') {
      await enhancedWeatherWatcher.start();
      results.weatherWatcher = 'started';
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Watcher(s) started successfully`,
        results
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Failed to start watcher: ${(error as Error).message}`,
      results
    }, { status: 500 });
  }
}

/**
 * Stoppt einen Watcher
 */
async function stopWatcher(watcher: string) {
  const results: any = {};

  try {
    if (watcher === 'csv' || watcher === 'all') {
      await enhancedCSVWatcher.stop();
      results.csvWatcher = 'stopped';
    }

    if (watcher === 'weather' || watcher === 'all') {
      await enhancedWeatherWatcher.stop();
      results.weatherWatcher = 'stopped';
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Watcher(s) stopped successfully`,
        results
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Failed to stop watcher: ${(error as Error).message}`,
      results
    }, { status: 500 });
  }
}

/**
 * Startet einen Watcher neu
 */
async function restartWatcher(watcher: string) {
  try {
    // Erst stoppen
    await stopWatcher(watcher);
    
    // Kurz warten
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Dann starten
    const startResult = await startWatcher(watcher);
    
    return NextResponse.json({
      success: true,
      data: {
        message: `Watcher(s) restarted successfully`,
        startResult: startResult
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Failed to restart watcher: ${(error as Error).message}`
    }, { status: 500 });
  }
}

/**
 * Manuelles Update
 */
async function manualUpdate(watcher: string) {
  const results: any = {};

  try {
    if (watcher === 'weather' || watcher === 'all') {
      const weatherData = await enhancedWeatherWatcher.manualUpdate();
      results.weather = weatherData;
    }

    if (watcher === 'csv' || watcher === 'all') {
      // Trigger CSV-Verarbeitung aller existierenden Dateien
      const bulkResult = await csvImportCoordinator.startBulkImport();
      results.csv = bulkResult;
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Manual update completed',
        results
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Manual update failed: ${(error as Error).message}`,
      results
    }, { status: 500 });
  }
}

/**
 * Leert Watcher-bezogene Caches
 */
async function clearWatcherCache(watcher: string) {
  try {
    const tags = [];

    if (watcher === 'csv' || watcher === 'all') {
      tags.push('table_data', 'station_ort', 'station_techno', 'station_band', 'station_heuballern');
    }

    if (watcher === 'weather' || watcher === 'all') {
      tags.push('weather');
    }

    if (watcher === 'all') {
      // Kompletter Cache-Clear
      await intelligentCache.clear();
    } else {
      // Tag-basierter Clear
      const clearedCount = await intelligentCache.invalidateByTags(tags);
      
      return NextResponse.json({
        success: true,
        data: {
          message: `Cache cleared for ${watcher} watcher`,
          clearedEntries: clearedCount
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'All caches cleared'
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Failed to clear cache: ${(error as Error).message}`
    }, { status: 500 });
  }
}

/**
 * Erzwingt CSV-Import aller Dateien
 */
async function forceImport() {
  try {
    const result = await csvImportCoordinator.startBulkImport();
    
    return NextResponse.json({
      success: true,
      data: {
        message: 'Force import started',
        jobIds: result.jobIds,
        estimatedDuration: result.estimatedDuration
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Force import failed: ${(error as Error).message}`
    }, { status: 500 });
  }
}

export { GET, POST };