import { useEffect, useRef, useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { getThresholdsForStationAndTime } from '@/lib/utils'

export interface StationDataPoint {
  time: string // "HH:MM"
  las: number
  ws?: number // wind speed
  wd?: string  // wind direction
  rh?: number  // relative humidity
  temp?: number // temperature
  datetime?: string // vollständiger Zeitstempel
}

// Notification functions
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false
  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") return false
  const permission = await Notification.requestPermission()
  return permission === "granted"
}

function showNoiseAlert(station: string, level: number, threshold: number) {
  const stationNames = {
    ort: "Ort",
    techno: "Techno Floor",
    heuballern: "Heuballern",
    band: "Band-Bühne"
  }
  const stationName = stationNames[station as keyof typeof stationNames] || station
  // Push Notification
  new Notification("Lärmalarm", {
    body: `${stationName}: ${level.toFixed(1)} dB überschreitet ${threshold} dB Grenzwert`,
    icon: "/placeholder-logo.png",
    tag: `noise-${station}-${threshold}`,
    requireInteraction: false,
  })
  // UI-Toast
  toast({
    title: `Lärmalarm: ${stationName}`,
    description: `${level.toFixed(1)} dB überschreitet ${threshold} dB Grenzwert`,
    variant: threshold === 60 ? "destructive" : "default"
  })
}

export function useStationData(
  station: string,
  interval: "24h" | "7d" = "24h",
  granularity: "15min" | "10min" | "5min" | "1min" | "1h" = "15min",
  page?: number,
  pageSize?: number // <- pageSize kann jetzt explizit übergeben werden
) {
  const [data, setData] = useState<StationDataPoint[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastAlertRef = useRef<{ level: number; time: number }>({ level: 0, time: 0 })
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    // Datenfetch nur im Client
    async function fetchAndSetData() {
      setLoading(true)
      setError(null)
      let url = `/api/station-data?station=${station}`
      if (interval) url += `&interval=${interval}`
      if (granularity) url += `&granularity=${granularity}`
      if (page) url += `&page=${page}`
      if (pageSize) url += `&pageSize=${pageSize}`
      try {
        const response = await fetch(url)
        if (!response.ok) {
          setError(`Fehler: ${response.status}`)
          setLoading(false)
          return
        }
        let result = await response.json()
        // Debug-Ausgabe: Datenlänge und erstes Element
        if (result && Array.isArray(result.data)) {
          console.log(`[useStationData] station=${station} interval=${interval} granularity=${granularity} -> data.length=`, result.data.length, 'first:', result.data[0]);
          setData(result.data)
          setTotalCount(result.totalCount || result.data.length)
        } else if (Array.isArray(result)) {
          console.log(`[useStationData] station=${station} interval=${interval} granularity=${granularity} -> data.length=`, result.length, 'first:', result[0]);
          setData(result)
          setTotalCount(result.length)
        } else {
          setData([])
          setTotalCount(0)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setData([])
        setTotalCount(0)
      } finally {
        setLoading(false)
      }
    }
    fetchAndSetData()
  }, [station, interval, granularity, page, pageSize])

  // Entferne alle fetchAndProcess-Intervall-Logik

  return { data, totalCount, loading, error }
} 