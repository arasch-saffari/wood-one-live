import { useState, useEffect, useRef } from 'react'

export interface TableDataPoint {
  datetime: string
  time: string
  las: number
  ws?: number | null
  wd?: string | null
  rh?: number | null
  station: string
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
  pollInterval?: number
}

export interface TableDataResult {
  data: TableDataPoint[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  loading: boolean
  error: string | null
}

export function useTableData(options: TableDataOptions = {}): TableDataResult {
  const {
    page = 1,
    pageSize = 25,
    sortBy = 'datetime',
    sortOrder = 'desc',
    station,
    dateFilter,
    searchQuery,
    showOnlyAlarms = false,
    pollInterval = 60000 // 1 Minute Standard
  } = options

  const [data, setData] = useState<TableDataPoint[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs für aktuelle Werte
  const optionsRef = useRef(options)
  optionsRef.current = options

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy: sortBy,
        sortOrder: sortOrder,
        ...(station && station !== '__all__' && { station }),
        ...(dateFilter && { dateFilter }),
        ...(searchQuery && { searchQuery }),
        ...(showOnlyAlarms && { showOnlyAlarms: 'true' })
      })

      const response = await fetch(`/api/table-data?${params}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Fehler beim Laden der Daten')
      }

      setData(result.data || [])
      setTotalCount(result.totalCount || 0)
      setTotalPages(result.totalPages || 0)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Laden der Daten'
      setError(errorMessage)
      console.error('[useTableData] Fehler:', err)
    } finally {
      setLoading(false)
    }
  }

  // Effect für initiales Laden und bei Änderungen
  useEffect(() => {
    fetchData()
  }, [page, pageSize, sortBy, sortOrder, station, dateFilter, searchQuery, showOnlyAlarms])

  // Polling-Effect
  useEffect(() => {
    if (pollInterval <= 0) return

    const interval = setInterval(fetchData, pollInterval)
    return () => clearInterval(interval)
  }, [pollInterval])

  return {
    data,
    totalCount,
    page,
    pageSize,
    totalPages,
    loading,
    error
  }
}