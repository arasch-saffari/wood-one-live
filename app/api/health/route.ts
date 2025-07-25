import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Import database with fallback
    let dbHealthy = false;
    try {
      const db = require('@/lib/database').default;
      const dbCheck = db.prepare('SELECT 1 as test').get() as { test: number };
      dbHealthy = dbCheck.test === 1;
    } catch (dbError) {
      console.warn('Database health check failed:', dbError);
    }

    // Get cache statistics if available
    let cacheStats = null;
    try {
      const { CacheService } = require('@/lib/cache');
      cacheStats = CacheService.getStats();
    } catch (cacheError) {
      console.warn('Cache stats not available:', cacheError);
    }

    // Get basic system info
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        connected: dbHealthy,
        status: dbHealthy ? 'healthy' : 'unhealthy'
      },
      cache: cacheStats ? {
        activeKeys: cacheStats.keys,
        stats: cacheStats.stats
      } : { status: 'not available' },
      responseTime: Date.now() - startTime
    };

    console.log('Health check completed:', healthData.status);

    return NextResponse.json({
      success: true,
      data: healthData
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Health check failed',
      message: (error as Error).message
    }, { status: 503 });
  }
}