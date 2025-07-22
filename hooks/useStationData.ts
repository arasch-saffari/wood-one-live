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
  pollInterval: number = 60000 // 1 Minute Standard
) {
  const [data, setData] = useState<StationDataPoint[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Refs für aktuelle Werte
  const stationRef = useRef(station)
  const intervalRef = useRef(interval)
  // Fetch-Funktion
  async function fetchAndSetData() {
    setLoading(true)
    setError(null)
    const url = `/api/station-data?station=${stationRef.current}&interval=${intervalRef.current}`
    try {
      const response = await fetch(url)
      if (!response.ok) {
        setError(`Fehler: ${response.status}`)
        setLoading(false)
        return
      }
      const json = await response.json()
      setData(json.data ?? [])
      setTotalCount(json.data?.length ?? 0)
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
    fetchAndSetData()
    if (pollInterval > 0) {
      const intervalId = setInterval(() => {
        fetchAndSetData()
      }, pollInterval)
      return () => clearInterval(intervalId)
    }
  }, [station, interval, pollInterval])
  return { data, totalCount, loading, error }
} 