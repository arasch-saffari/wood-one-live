// Service für serverseitige Tabellendaten mit Sortierung und Pagination
import db from './database'

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

export function getAllStationsTableData(options: TableDataOptions = {}): TableDataResult {
  const {
    page = 1,
    pageSize = 25,
    sortBy = 'datetime',
    sortOrder = 'desc',
    station,
    dateFilter,
    searchQuery,
    showOnlyAlarms = false
  } = options

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

  // Datum-Filter
  if (dateFilter) {
    const [day, month, year] = dateFilter.split('.')
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    whereConditions.push('DATE(m.datetime) = ?')
    queryParams.push(isoDate)
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

  // Queries ausführen
  const countParams = queryParams.slice(0, -2) // Ohne LIMIT/OFFSET
  const results = db.prepare(baseQuery).all(...queryParams) as Array<{
    datetime: string
    time: string
    las: number
    ws?: number | null
    wd?: string | null
    rh?: number | null
    station: string
  }>

  const countResult = db.prepare(countQuery).get(...countParams) as { total: number }
  const totalCount = countResult.total
  const totalPages = Math.ceil(totalCount / limit)

  // Station-Namen normalisieren für Frontend
  const normalizedResults = results.map(row => ({
    ...row,
    station: normalizeStationName(row.station)
  }))

  return {
    data: normalizedResults,
    totalCount,
    page,
    pageSize: limit,
    totalPages
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