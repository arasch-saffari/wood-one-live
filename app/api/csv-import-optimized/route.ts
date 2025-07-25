import { NextRequest, NextResponse } from 'next/server';
import { csvImportCoordinator } from '@/lib/csv-import-coordinator';
import { intelligentCache } from '@/lib/intelligent-cache';

// Import with fallbacks
let logger: any = console;
let withErrorHandler: any = null;
let withRateLimit: any = null;

try {
  const loggerModule = require('@/lib/logger');
  logger = loggerModule.logger || console;
} catch (error) {
  console.warn('Logger module not available');
}

try {
  const errorModule = require('@/lib/middleware/error-handler');
  withErrorHandler = errorModule.withErrorHandler;
} catch (error) {
  console.warn('Error handler middleware not available');
}

try {
  const rateLimitModule = require('@/lib/middleware/rate-limit');
  withRateLimit = rateLimitModule.withRateLimit;
} catch (error) {
  console.warn('Rate limit middleware not available');
}

/**
 * Startet optimierten CSV-Import
 */
async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { action, station, filePath, priority = 'normal' } = body;

    logger.info({ action, station, filePath, priority }, 'CSV import request received');

    switch (action) {
      case 'single':
        if (!station || !filePath) {
          return NextResponse.json({
            success: false,
            error: 'Missing required parameters: station, filePath'
          }, { status: 400 });
        }

        const jobId = await csvImportCoordinator.addImportJob(station, filePath, priority);
        
        return NextResponse.json({
          success: true,
          data: {
            jobId,
            message: 'Import job queued successfully'
          }
        });

      case 'directory':
        if (!station || !filePath) {
          return NextResponse.json({
            success: false,
            error: 'Missing required parameters: station, filePath (directory)'
          }, { status: 400 });
        }

        const jobIds = await csvImportCoordinator.addDirectoryImport(station, filePath, priority);
        
        return NextResponse.json({
          success: true,
          data: {
            jobIds,
            count: jobIds.length,
            message: `${jobIds.length} import jobs queued successfully`
          }
        });

      case 'bulk':
        const bulkResult = await csvImportCoordinator.startBulkImport();
        
        return NextResponse.json({
          success: true,
          data: {
            ...bulkResult,
            message: `Bulk import started with ${bulkResult.jobIds.length} jobs`
          }
        });

      case 'status':
        const status = csvImportCoordinator.getStatus();
        
        return NextResponse.json({
          success: true,
          data: status
        });

      case 'cancel':
        const { jobId: cancelJobId } = body;
        if (!cancelJobId) {
          return NextResponse.json({
            success: false,
            error: 'Missing jobId parameter'
          }, { status: 400 });
        }

        const cancelled = await csvImportCoordinator.cancelJob(cancelJobId);
        
        return NextResponse.json({
          success: true,
          data: {
            cancelled,
            message: cancelled ? 'Job cancelled successfully' : 'Job could not be cancelled (may be active)'
          }
        });

      case 'pause':
        csvImportCoordinator.pause();
        
        return NextResponse.json({
          success: true,
          data: { message: 'Import processing paused' }
        });

      case 'resume':
        csvImportCoordinator.resume();
        
        return NextResponse.json({
          success: true,
          data: { message: 'Import processing resumed' }
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}. Supported actions: single, directory, bulk, status, cancel, pause, resume`
        }, { status: 400 });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error({ error, duration }, 'CSV import API error');

    return NextResponse.json({
      success: false,
      error: 'CSV import failed',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Gibt Import-Status und Statistiken zurück
 */
async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const detailed = searchParams.get('detailed') === 'true';
    const jobId = searchParams.get('jobId');

    if (jobId) {
      // Status für spezifischen Job
      const status = csvImportCoordinator.getStatus();
      const job = [...status.activeJobs, ...status.queuedJobs, ...status.recentCompleted]
        .find(j => j.id === jobId);

      if (!job) {
        return NextResponse.json({
          success: false,
          error: 'Job not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: job
      });
    }

    // Allgemeiner Status
    const status = csvImportCoordinator.getStatus();
    
    if (!detailed) {
      // Vereinfachter Status
      return NextResponse.json({
        success: true,
        data: {
          stats: status.stats,
          activeJobsCount: status.activeJobs.length,
          queuedJobsCount: status.queuedJobs.length,
          isProcessing: status.activeJobs.length > 0 || status.queuedJobs.length > 0
        }
      });
    }

    // Detaillierter Status
    const cacheStats = intelligentCache.getStats();
    
    return NextResponse.json({
      success: true,
      data: {
        ...status,
        cacheStats,
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          cpuCount: require('os').cpus().length,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        }
      }
    });

  } catch (error) {
    logger.error({ error }, 'CSV import status API error');

    return NextResponse.json({
      success: false,
      error: 'Failed to get import status',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
    }, { status: 500 });
  }
}

// Apply middleware if available
let finalPOST = POST;
let finalGET = GET;

if (withErrorHandler) {
  finalPOST = withErrorHandler(finalPOST);
  finalGET = withErrorHandler(finalGET);
}

if (withRateLimit) {
  // Weniger strenge Rate-Limits für Import-API
  finalPOST = withRateLimit(finalPOST, { windowMs: 60000, maxRequests: 10 });
  finalGET = withRateLimit(finalGET, { windowMs: 60000, maxRequests: 30 });
}

export { finalPOST as POST, finalGET as GET };