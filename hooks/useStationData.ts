import { useEffect, useState, useRef } from "react"

export interface StationDataPoint {
  time: string // "HH:MM"
  las: number
  ws?: number // wind speed
  wd?: string  // wind direction
  rh?: number  // relative humidity
  temp?: number // temperature
  datetime?: string // vollständiger Zeitstempel
}

export function useStationData(
  station: string,
  interval: "24h" | "7d" = "24h",
  pollInterval: number = 60000, // 1 Minute Standard
  page: number = 1,
  pageSize: number = 1000,
  aggregate?: string
) {
  const [data, setData] = useState<StationDataPoint[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(page)
  const [currentPageSize, setCurrentPageSize] = useState(pageSize)
  // Refs für aktuelle Werte
  const stationRef = useRef(station)
  const intervalRef = useRef(interval)
  const pageRef = useRef(page)
  const pageSizeRef = useRef(pageSize)
  // Fetch-Funktion
  async function fetchAndSetData() {
    setLoading(true)
    setError(null)
    const url = `/api/station-data?station=${stationRef.current}&interval=${intervalRef.current}&page=${pageRef.current}&pageSize=${pageSizeRef.current}` + (aggregate ? `&aggregate=${aggregate}` : '')
    try {
      const response = await fetch(url)
      if (!response.ok) {
        setError(`Fehler: ${response.status}`)
        setLoading(false)
        return
      }
      const json = await response.json()
      setData(json.data ?? [])
      setTotalCount(json.totalCount ?? 0)
      setCurrentPage(json.page ?? pageRef.current)
      setCurrentPageSize(json.pageSize ?? pageSizeRef.current)
      setLoading(false)
    } catch (e: unknown) {
      if (typeof e === 'object' && e && 'message' in e && typeof (e as { message?: string }).message === 'string') {
        setError((e as { message: string }).message || 'Fehler beim Laden.')
      } else {
        setError('Fehler beim Laden.')
      }
      setLoading(false)
    }
  }
  // Polling robust machen
  useEffect(() => {
    stationRef.current = station
    intervalRef.current = interval
    pageRef.current = page
    pageSizeRef.current = pageSize
    fetchAndSetData()
    if (pollInterval > 0) {
      const intervalId = setInterval(() => {
        fetchAndSetData()
      }, pollInterval)
      return () => clearInterval(intervalId)
    }
  }, [station, interval, pollInterval, page, pageSize, aggregate])
  return { data, totalCount, loading, error, page: currentPage, pageSize: currentPageSize }
} 