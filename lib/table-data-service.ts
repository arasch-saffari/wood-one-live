// Service für serverseitige Tabellendaten mit Sortierung und Pagination
import db from './database'
import { logger, DatabaseError, ValidationError } from './logger'
import { intelligentCache } from './intelligent-cache'
import { PerformanceMonitor } from './database-optimizer'

// Import with fallbacks to handle missing dependencies gracefully
let CacheService: any = null;
let CacheKeys: any = null;
let TimeUtils: any = null;
let validateRequest: any = null;
let getTableDataSchema: any = null;

try {
  const cacheModule = require('./cache');
  CacheService = cacheModule.CacheService;
  CacheKeys = cacheModule.CacheKeys;
} catch (error) {
  logger.warn('Cache module not available, caching disabled');
}

try {
  const timeModule = require('./time-utils');
  TimeUtils = timeModule.TimeUtils;
} catch (error) {
  logger.warn('Time utils module not available, using fallback');
}

try {
  const validationModule = require('./validation');
  validateRequest = validationModule.validateRequest;
  getTableDataSchema = validationModule.getTableDataSchema;
} catch (error) {
  logger.warn('Validation module not available, validation disabled');
}

export interface TableDataOptions {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  station?: string
  dateFilter?: string
  startDate?: string
  endDate?: string
  searchQuery?: string
  showOnlyAlarms?: boolean
}

export interface TableDataResult {
  data: Array<{
    datetime: string
    time: string
    las: number
    ws?: number | null
    wd?: string | null
    rh?: number | null
    station: string
  }>
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getAllStationsTableData(options: TableDataOptions = {}): Promise<TableDataResult> {
  const performanceEnd = PerformanceMonitor.startQuery('getAllStationsTableData');
  const startTime = Date.now();
  
  try {
    // Use validation if available, otherwise use basic parameter extraction
    let validatedData = options;
    if (validateRequest && getTableDataSchema) {
      try {
        const validation = validateRequest(getTableDataSchema, options);
        if (!validation.success) {
          throw new ValidationError('Invalid table data parameters', validation.errors.errors);
        }
        validatedData = validation.data;
      } catch (validationError) {
        logger.warn({ error: validationError }, 'Validation failed, using basic parameter extraction');
      }
    }

    const {
      page = 1,
      pageSize = 25,
      sortBy = 'datetime',
      sortOrder = 'desc',
      station,
      dateFilter, // Keep original parameter name for backward compatibility
      startDate,
      endDate,
      searchQuery,
      showOnlyAlarms = false
    } = validatedData;

    // Generate intelligent cache key
    const cacheKey = generateCacheKey({
      station: station || '__all__',
      page,
      pageSize,
      sortBy,
      sortOrder,
      startDate,
      endDate,
      searchQuery,
      showOnlyAlarms
    });

    // Try intelligent cache first
    const cached = await intelligentCache.get<TableDataResult>(cacheKey, [
      'table_data',
      `station_${station || 'all'}`,
      showOnlyAlarms ? 'alarms' : 'normal'
    ]);

    if (cached) {
      logger.debug({ cacheKey }, 'Table data served from intelligent cache');
      performanceEnd();
      return cached;
    }

    // Fallback to legacy cache
    if (CacheService && CacheKeys) {
      try {
        const legacyCacheKey = `table_data_${station || '__all__'}_${page}_${pageSize}_${sortBy}_${sortOrder}_${startDate || ''}_${endDate || ''}_${searchQuery || ''}_${showOnlyAlarms}`;
        const legacyCached = CacheService.get(legacyCacheKey) as TableDataResult;
        if (legacyCached) {
          logger.debug({ legacyCacheKey }, 'Table data served from legacy cache');
          // Migrate to intelligent cache
          await intelligentCache.set(cacheKey, legacyCached, {
            ttl: 5 * 60 * 1000, // 5 minutes
            tags: ['table_data', `station_${station || 'all'}`],
            priority: 'normal'
          });
          performanceEnd();
          return legacyCached;
        }
      } catch (cacheError) {
        logger.warn({ error: cacheError }, 'Legacy cache access failed');
      }
    }

    // Validierung der Parameter mit korrekter Sortierung
    const validSortFields = ['datetime', 'time', 'las', 'ws', 'wd', 'rh', 'station']
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'datetime'
    const safeSortOrder = ['asc', 'desc'].includes(sortOrder?.toLowerCase()) ? sortOrder.toUpperCase() : 'DESC'
  
  const limit = Math.min(Math.max(1, pageSize), 1000)
  const offset = Math.max(0, (page - 1) * limit)

  // Base Query mit JOINs für Wetterdaten
  let baseQuery = `
    SELECT 
      m.datetime,
      m.time,
      m.las,
      w.windSpeed as ws,
      w.windDir as wd,
      w.relHumidity as rh,
      m.station
    FROM measurements m
    LEFT JOIN weather w ON w.station = 'global' 
      AND w.time = (
        substr(m.time,1,3) || printf('%02d', (CAST(substr(m.time,4,2) AS INTEGER) / 10) * 10) || ':00'
      )
  `

  let whereConditions: string[] = []
  let queryParams: (string | number | boolean)[] = []

  // Station-Filter
  if (station && station !== '__all__') {
    let stationKey = station.toLowerCase()
    if (stationKey === 'techno floor') stationKey = 'techno'
    if (stationKey === 'band bühne') stationKey = 'band'
    
    whereConditions.push('m.station = ?')
    queryParams.push(stationKey)
  }

  // Date range filters - use TimeUtils if available, otherwise use basic date handling
  if (startDate && TimeUtils) {
    try {
      const startUtc = TimeUtils.parseUserDate(startDate).toUTC().toISO();
      whereConditions.push('m.datetime >= ?');
      queryParams.push(startUtc);
    } catch (error) {
      logger.warn({ error, startDate }, 'Failed to parse start date with TimeUtils, skipping filter');
    }
  } else if (startDate) {
    // Fallback to basic date handling
    whereConditions.push('DATE(m.datetime) >= ?');
    queryParams.push(startDate);
  }

  if (endDate && TimeUtils) {
    try {
      const endUtc = TimeUtils.parseUserDate(endDate).endOf('day').toUTC().toISO();
      whereConditions.push('m.datetime <= ?');
      queryParams.push(endUtc);
    } catch (error) {
      logger.warn({ error, endDate }, 'Failed to parse end date with TimeUtils, skipping filter');
    }
  } else if (endDate) {
    // Fallback to basic date handling
    whereConditions.push('DATE(m.datetime) <= ?');
    queryParams.push(endDate);
  }

  // Legacy dateFilter support for backward compatibility
  if (dateFilter && !startDate && !endDate) {
    const [day, month, year] = dateFilter.split('.');
    if (day && month && year) {
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      whereConditions.push('DATE(m.datetime) = ?');
      queryParams.push(isoDate);
    }
  }

  // Such-Filter
  if (searchQuery) {
    whereConditions.push('(m.station LIKE ? OR m.time LIKE ? OR CAST(m.las AS TEXT) LIKE ?)')
    const searchPattern = `%${searchQuery}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }

  // Alarm-Filter (komplexer - benötigt Thresholds-JOIN)
  if (showOnlyAlarms) {
    baseQuery = `
      SELECT 
        m.datetime,
        m.time,
        m.las,
        w.windSpeed as ws,
        w.windDir as wd,
        w.relHumidity as rh,
        m.station
      FROM measurements m
      LEFT JOIN weather w ON w.station = 'global' 
        AND w.time = (
          substr(m.time,1,3) || printf('%02d', (CAST(substr(m.time,4,2) AS INTEGER) / 10) * 10) || ':00'
        )
      JOIN thresholds t ON t.station = m.station
      WHERE m.las >= t.alarm_threshold
        AND (
          (t.from_time <= t.to_time AND 
           CAST(substr(m.time, 1, 2) AS INTEGER) * 60 + CAST(substr(m.time, 4, 2) AS INTEGER) >= 
           CAST(substr(t.from_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.from_time, 4, 2) AS INTEGER)
           AND CAST(substr(m.time, 1, 2) AS INTEGER) * 60 + CAST(substr(m.time, 4, 2) AS INTEGER) < 
           CAST(substr(t.to_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.to_time, 4, 2) AS INTEGER))
          OR
          (t.from_time > t.to_time AND (
           CAST(substr(m.time, 1, 2) AS INTEGER) * 60 + CAST(substr(m.time, 4, 2) AS INTEGER) >= 
           CAST(substr(t.from_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.from_time, 4, 2) AS INTEGER)
           OR CAST(substr(m.time, 1, 2) AS INTEGER) * 60 + CAST(substr(m.time, 4, 2) AS INTEGER) < 
           CAST(substr(t.to_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.to_time, 4, 2) AS INTEGER)))
        )
    `
  }

  // WHERE-Bedingungen hinzufügen
  if (whereConditions.length > 0) {
    const whereClause = showOnlyAlarms ? ' AND ' + whereConditions.join(' AND ') : ' WHERE ' + whereConditions.join(' AND ')
    baseQuery += whereClause
  }

  // Sortierung hinzufügen - korrekte Behandlung für verschiedene Spalten
  let orderByClause = '';
  if (safeSortBy === 'ws' || safeSortBy === 'wd' || safeSortBy === 'rh') {
    // Wetter-Spalten aus dem JOIN - mit NULL-Behandlung
    const weatherColumn = safeSortBy === 'ws' ? 'windSpeed' : safeSortBy === 'wd' ? 'windDir' : 'relHumidity';
    orderByClause = ` ORDER BY w.${weatherColumn} ${safeSortOrder} NULLS LAST`;
  } else if (safeSortBy === 'station') {
    // Station-Spalte
    orderByClause = ` ORDER BY m.station ${safeSortOrder}`;
  } else {
    // Measurements-Spalten (datetime, time, las) - mit sekundärer Sortierung
    orderByClause = ` ORDER BY m.${safeSortBy} ${safeSortOrder}`;
    
    // Sekundäre Sortierung für bessere Konsistenz
    if (safeSortBy !== 'datetime') {
      orderByClause += `, m.datetime DESC`;
    }
  }
  
  baseQuery += orderByClause;

  // Pagination hinzufügen
  baseQuery += ` LIMIT ? OFFSET ?`
  queryParams.push(limit, offset)

  // Count-Query für totalCount
  let countQuery = `
    SELECT COUNT(*) as total
    FROM measurements m
  `
  
  if (showOnlyAlarms) {
    countQuery += `
      JOIN thresholds t ON t.station = m.station
      WHERE m.las >= t.alarm_threshold
        AND (
          (t.from_time <= t.to_time AND 
           CAST(substr(m.time, 1, 2) AS INTEGER) * 60 + CAST(substr(m.time, 4, 2) AS INTEGER) >= 
           CAST(substr(t.from_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.from_time, 4, 2) AS INTEGER)
           AND CAST(substr(m.time, 1, 2) AS INTEGER) * 60 + CAST(substr(m.time, 4, 2) AS INTEGER) < 
           CAST(substr(t.to_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.to_time, 4, 2) AS INTEGER))
          OR
          (t.from_time > t.to_time AND (
           CAST(substr(m.time, 1, 2) AS INTEGER) * 60 + CAST(substr(m.time, 4, 2) AS INTEGER) >= 
           CAST(substr(t.from_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.from_time, 4, 2) AS INTEGER)
           OR CAST(substr(m.time, 1, 2) AS INTEGER) * 60 + CAST(substr(m.time, 4, 2) AS INTEGER) < 
           CAST(substr(t.to_time, 1, 2) AS INTEGER) * 60 + CAST(substr(t.to_time, 4, 2) AS INTEGER)))
        )
    `
  }

  if (whereConditions.length > 0 && !showOnlyAlarms) {
    countQuery += ' WHERE ' + whereConditions.join(' AND ')
  } else if (whereConditions.length > 0 && showOnlyAlarms) {
    countQuery += ' AND ' + whereConditions.join(' AND ')
  }

    // Execute queries with error handling
    const countParams = queryParams.slice(0, -2); // Without LIMIT/OFFSET
    
    let results: Array<{
      datetime: string
      time: string
      las: number
      ws?: number | null
      wd?: string | null
      rh?: number | null
      station: string
    }>;
    
    let countResult: { total: number };

    try {
      const queryStartTime = Date.now();
      results = db.prepare(baseQuery).all(...queryParams) as typeof results;
      const queryDuration = Date.now() - queryStartTime;
      
      // Log slow queries
      if (queryDuration > 200) {
        logger.warn({
          query: baseQuery,
          duration: queryDuration,
          params: queryParams.length
        }, 'Slow table data query detected');
      }

      countResult = db.prepare(countQuery).get(...countParams) as { total: number };
    } catch (error) {
      logger.error({ error, baseQuery, queryParams }, 'Database query failed in table data service');
      throw new DatabaseError('Failed to fetch table data', { query: baseQuery, error });
    }

    const totalCount = countResult.total;
    const totalPages = Math.ceil(totalCount / limit);

    // Station-Namen normalisieren für Frontend mit Zeitstempel-Formatierung
    const normalizedResults = results.map(row => ({
      ...row,
      datetime: TimeUtils && TimeUtils.formatForApi ? TimeUtils.formatForApi(row.datetime).local : row.datetime,
      station: normalizeStationName(row.station)
    }));

    const result: TableDataResult = {
      data: normalizedResults,
      totalCount,
      page,
      pageSize: limit,
      totalPages
    };

    // Cache the result in intelligent cache
    await intelligentCache.set(cacheKey, result, {
      ttl: calculateCacheTTL(options),
      tags: [
        'table_data',
        `station_${station || 'all'}`,
        showOnlyAlarms ? 'alarms' : 'normal',
        `page_${page}`
      ],
      priority: page === 1 ? 'high' : 'normal', // First page gets high priority
      persistToDisk: totalCount > 1000 // Persist large datasets
    });

    // Fallback to legacy cache
    if (CacheService) {
      try {
        const legacyCacheKey = `table_data_${station || '__all__'}_${page}_${pageSize}_${sortBy}_${sortOrder}_${startDate || ''}_${endDate || ''}_${searchQuery || ''}_${showOnlyAlarms}`;
        CacheService.set(legacyCacheKey, result, 300); // Cache for 5 minutes
      } catch (cacheError) {
        logger.warn({ error: cacheError }, 'Failed to cache result in legacy cache');
      }
    }

    // Log performance
    const totalDuration = performanceEnd();
    logger.info({
      station: station || '__all__',
      page,
      pageSize: limit,
      totalCount,
      duration: totalDuration,
      cached: false,
      cacheKey
    }, 'Table data query completed');

    return result;

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    logger.error({
      error,
      options,
      duration: totalDuration
    }, 'Table data service error');
    
    if (error instanceof ValidationError || error instanceof DatabaseError) {
      throw error;
    }
    
    throw new DatabaseError('Unexpected error in table data service', { originalError: error });
  }
}

/**
 * Generiert einen intelligenten Cache-Key
 */
function generateCacheKey(options: {
  station: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  showOnlyAlarms: boolean;
}): string {
  const parts = [
    'table_data',
    options.station,
    `p${options.page}`,
    `ps${options.pageSize}`,
    `sb${options.sortBy}`,
    `so${options.sortOrder}`,
    options.startDate ? `sd${options.startDate}` : '',
    options.endDate ? `ed${options.endDate}` : '',
    options.searchQuery ? `sq${Buffer.from(options.searchQuery).toString('base64').substring(0, 10)}` : '',
    options.showOnlyAlarms ? 'alarms' : 'normal'
  ].filter(Boolean);
  
  return parts.join('_');
}

/**
 * Berechnet adaptive Cache-TTL basierend auf Anfrage-Parametern
 */
function calculateCacheTTL(options: TableDataOptions): number {
  const baseTime = 5 * 60 * 1000; // 5 Minuten base
  
  // Aktuelle Daten (erste Seite) - kürzere TTL
  if (options.page === 1 && !options.startDate && !options.endDate) {
    return 2 * 60 * 1000; // 2 Minuten
  }
  
  // Historische Daten - längere TTL
  if (options.startDate || options.endDate) {
    const now = new Date();
    const startDate = options.startDate ? new Date(options.startDate) : null;
    
    if (startDate && (now.getTime() - startDate.getTime()) > 7 * 24 * 60 * 60 * 1000) {
      return 60 * 60 * 1000; // 1 Stunde für Daten älter als 7 Tage
    }
    
    return 15 * 60 * 1000; // 15 Minuten für neuere historische Daten
  }
  
  // Alarm-Daten - mittlere TTL
  if (options.showOnlyAlarms) {
    return 3 * 60 * 1000; // 3 Minuten
  }
  
  // Suchqueries - kürzere TTL
  if (options.searchQuery) {
    return 2 * 60 * 1000; // 2 Minuten
  }
  
  // Spätere Seiten - längere TTL
  if (options.page && options.page > 3) {
    return 10 * 60 * 1000; // 10 Minuten
  }
  
  return baseTime;
}

function normalizeStationName(station: string): string {
  const stationMap: { [key: string]: string } = {
    'ort': 'Ort',
    'techno': 'Techno Floor',
    'band': 'Band Bühne',
    'heuballern': 'Heuballern'
  }
  return stationMap[station.toLowerCase()] || station
}

/**
 * Invalidiert Cache für eine Station
 */
export async function invalidateStationCache(station: string): Promise<void> {
  try {
    await intelligentCache.invalidateByTags([
      'table_data',
      `station_${station}`,
      `station_all` // Auch "alle Stationen" Cache invalidieren
    ]);
    
    logger.info({ station }, 'Station cache invalidated');
  } catch (error) {
    logger.warn({ error, station }, 'Failed to invalidate station cache');
  }
}

/**
 * Wärmt den Cache für häufig genutzte Queries vor
 */
export async function warmupTableDataCache(): Promise<void> {
  const stations = ['ort', 'techno', 'band', 'heuballern'];
  const commonQueries = [
    { page: 1, pageSize: 25, sortBy: 'datetime', sortOrder: 'desc' as const },
    { page: 1, pageSize: 50, sortBy: 'datetime', sortOrder: 'desc' as const },
    { page: 1, pageSize: 25, sortBy: 'datetime', sortOrder: 'desc' as const, showOnlyAlarms: true }
  ];

  const warmupKeys = [];
  
  // Alle Stationen
  for (const query of commonQueries) {
    warmupKeys.push({
      key: generateCacheKey({ station: '__all__', ...query, showOnlyAlarms: query.showOnlyAlarms || false }),
      generator: () => getAllStationsTableData(query),
      tags: ['table_data', 'station_all', query.showOnlyAlarms ? 'alarms' : 'normal']
    });
  }
  
  // Einzelne Stationen
  for (const station of stations) {
    for (const query of commonQueries) {
      warmupKeys.push({
        key: generateCacheKey({ station, ...query, showOnlyAlarms: query.showOnlyAlarms || false }),
        generator: () => getAllStationsTableData({ ...query, station }),
        tags: ['table_data', `station_${station}`, query.showOnlyAlarms ? 'alarms' : 'normal']
      });
    }
  }

  await intelligentCache.warmup(warmupKeys);
}

export default getAllStationsTableData