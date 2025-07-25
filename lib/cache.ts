// Import with fallback to avoid dependency issues
let NodeCache: any = null;
let logger: any = console;

try {
  NodeCache = require('node-cache');
} catch (error) {
  console.warn('node-cache not available, using fallback');
}

try {
  const loggerModule = require('./logger');
  logger = loggerModule.logger;
} catch (error) {
  console.warn('Logger not available, using console');
}

// Configure cache with environment variables
const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || '300', 10);

// Initialize cache with fallback
let cache: any = null;

if (NodeCache) {
  try {
    cache = new NodeCache({
      stdTTL: CACHE_TTL,
      checkperiod: CACHE_TTL * 0.2, // Check for expired keys every 20% of TTL
      useClones: false, // Better performance, but be careful with object mutations
    });

    // Cache statistics
    cache.on('set', (key: string, value: any) => {
      if (logger.debug) {
        logger.debug({ key, ttl: CACHE_TTL }, 'Cache key set');
      }
    });

    cache.on('del', (key: string, value: any) => {
      if (logger.debug) {
        logger.debug({ key }, 'Cache key deleted');
      }
    });

    cache.on('expired', (key: string, value: any) => {
      if (logger.debug) {
        logger.debug({ key }, 'Cache key expired');
      }
    });
  } catch (error) {
    console.warn('Failed to initialize cache:', error);
    cache = null;
  }
} else {
  // Fallback in-memory cache
  const fallbackCache = new Map<string, { value: any; expires: number }>();
  
  cache = {
    get: (key: string) => {
      const item = fallbackCache.get(key);
      if (item && item.expires > Date.now()) {
        return item.value;
      }
      if (item) {
        fallbackCache.delete(key);
      }
      return undefined;
    },
    set: (key: string, value: any, ttl?: number) => {
      const expires = Date.now() + (ttl || CACHE_TTL) * 1000;
      fallbackCache.set(key, { value, expires });
      return true;
    },
    del: (key: string) => {
      const deleted = fallbackCache.delete(key);
      return deleted ? 1 : 0;
    },
    flushAll: () => {
      fallbackCache.clear();
    },
    keys: () => Array.from(fallbackCache.keys()),
    getStats: () => ({ keys: fallbackCache.size, hits: 0, misses: 0 })
  };
}

export { cache };

// Typed cache wrapper functions
export class CacheService {
  static get<T>(key: string): T | undefined {
    if (!cache) return undefined;
    
    try {
      const value = cache.get<T>(key);
      if (value !== undefined && logger.debug) {
        logger.debug({ key }, 'Cache hit');
      } else if (logger.debug) {
        logger.debug({ key }, 'Cache miss');
      }
      return value;
    } catch (error) {
      if (logger.error) {
        logger.error({ error, key }, 'Cache get error');
      } else {
        console.error('Cache get error:', error);
      }
      return undefined;
    }
  }

  static set<T>(key: string, value: T, ttl?: number): boolean {
    if (!cache) return false;
    
    try {
      const result = cache.set(key, value, ttl || CACHE_TTL);
      if (logger.debug) {
        logger.debug({ key, ttl: ttl || CACHE_TTL }, 'Cache set');
      }
      return result;
    } catch (error) {
      if (logger.error) {
        logger.error({ error, key }, 'Cache set error');
      } else {
        console.error('Cache set error:', error);
      }
      return false;
    }
  }

  static del(key: string): number {
    if (!cache) return 0;
    
    try {
      const result = cache.del(key);
      if (logger.debug) {
        logger.debug({ key }, 'Cache delete');
      }
      return result;
    } catch (error) {
      if (logger.error) {
        logger.error({ error, key }, 'Cache delete error');
      } else {
        console.error('Cache delete error:', error);
      }
      return 0;
    }
  }

  static flush(): void {
    if (!cache) return;
    
    try {
      cache.flushAll();
      if (logger.info) {
        logger.info('Cache flushed');
      }
    } catch (error) {
      if (logger.error) {
        logger.error({ error }, 'Cache flush error');
      } else {
        console.error('Cache flush error:', error);
      }
    }
  }

  static getStats() {
    if (!cache) {
      return { keys: 0, stats: { keys: 0, hits: 0, misses: 0 } };
    }
    
    try {
      return {
        keys: cache.keys().length,
        stats: cache.getStats(),
      };
    } catch (error) {
      return { keys: 0, stats: { keys: 0, hits: 0, misses: 0 } };
    }
  }

  // Utility method for cache-or-compute pattern
  static async getOrSet<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const computed = await computeFn();
      this.set(key, computed, ttl);
      return computed;
    } catch (error) {
      if (logger.error) {
        logger.error({ error, key }, 'Cache getOrSet compute error');
      } else {
        console.error('Cache getOrSet compute error:', error);
      }
      throw error;
    }
  }
}

// Predefined cache keys to avoid typos
export const CacheKeys = {
  STATIONS: 'stations',
  THRESHOLDS: 'thresholds',
  STATION_META: (station: string) => `station_meta_${station}`,
  MEASUREMENTS: (station: string, page: number, pageSize: number) => 
    `measurements_${station}_${page}_${pageSize}`,
  TABLE_DATA: (station: string, page: number, pageSize: number) => 
    `table_data_${station}_${page}_${pageSize}`,
  WEATHER_DATA: (station: string) => `weather_${station}`,
} as const;