// Service für serverseitige Tabellendaten mit Sortierung und Pagination
import db from './database'
import { logger, DatabaseError, ValidationError } from './logger'

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

    // Try to use cache if available
    let cached = null;
    if (CacheService && CacheKeys) {
      try {
        const cacheKey = `table_data_${station || '__all__'}_${page}_${pageSize}_${sortBy}_${sortOrder}_${startDate || ''}_${endDate || ''}_${searchQuery || ''}_${showOnlyAlarms}`;
        cached = CacheService.get<TableDataResult>(cacheKey);
        if (cached) {
          logger.debug({ cacheKey }, 'Table data served from cache');
          return cached;
        }
      } catch (cacheError) {
        logger.warn({ error: cacheError }, 'Cache access failed');
      }
    }

    // Validierung der Parameter
    const validSortFields = ['datetime', 'time', 'las', 'ws', 'wd', 'rh', 'station']
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'datetime'
    const safeSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder.toUpperCase() : 'DESC'
  
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

  // Sortierung hinzufügen
  baseQuery += ` ORDER BY m.${safeSortBy} ${safeSortOrder}`

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

    // Cache the result if cache is available
    if (CacheService && cached !== null) {
      try {
        const cacheKey = `table_data_${station || '__all__'}_${page}_${pageSize}_${sortBy}_${sortOrder}_${startDate || ''}_${endDate || ''}_${searchQuery || ''}_${showOnlyAlarms}`;
        CacheService.set(cacheKey, result, 300); // Cache for 5 minutes
      } catch (cacheError) {
        logger.warn({ error: cacheError }, 'Failed to cache result');
      }
    }

    // Log performance
    const totalDuration = Date.now() - startTime;
    logger.info({
      station: station || '__all__',
      page,
      pageSize: limit,
      totalCount,
      duration: totalDuration,
      cached: false
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

function normalizeStationName(station: string): string {
  const stationMap: { [key: string]: string } = {
    'ort': 'Ort',
    'techno': 'Techno Floor',
    'band': 'Band Bühne',
    'heuballern': 'Heuballern'
  }
  return stationMap[station.toLowerCase()] || station
}

export default getAllStationsTableData