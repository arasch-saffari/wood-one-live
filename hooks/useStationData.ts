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
  pageSize?: number
) {
  const [data, setData] = useState<StationDataPoint[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastAlertRef = useRef<{ level: number; time: number }>({ level: 0, time: 0 })
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    fetch('/api/admin/config').then(res => res.json()).then(setConfig)
  }, [])

  async function fetchAndProcess() {
    try {
      let url = `/api/station-data?station=${encodeURIComponent(station)}&interval=${interval}&granularity=${granularity}`
      if (page && pageSize) {
        url += `&page=${page}&pageSize=${pageSize}`
      }
      const response = await fetch(url)
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: `Keine CSV-Daten für ${station}`,
            description: `Für die Station '${station}' wurden keine CSV-Dateien gefunden. Bitte lade eine CSV-Datei hoch.`,
            variant: "destructive"
          })
        } else {
          console.error('Failed to fetch station data')
        }
        setData([])
        setTotalCount(0)
        return
      }
      const result = await response.json()
      if (result && Array.isArray(result.data)) {
        setData(result.data)
        setTotalCount(result.totalCount || result.data.length)
      } else if (Array.isArray(result)) {
        setData(result)
        setTotalCount(result.length)
      } else {
        setData([])
        setTotalCount(0)
      }
      // Check for noise alerts
      if (result.length === 0) {
        toast({
          title: `Keine CSV-Daten für ${station}`,
          description: `Für die Station '${station}' wurden keine CSV-Daten gefunden. Bitte lade eine CSV-Datei hoch.`,
          variant: "destructive"
        })
      }
      // enableNotifications aus Config prüfen
      let enableNotifications = true
      try {
        const configRes = await fetch('/api/admin/config')
        if (configRes.ok) {
          const config = await configRes.json()
          if (config.enableNotifications === false) enableNotifications = false
        }
      } catch {}
      if (result.length > 0 && enableNotifications && config) {
        const currentLevel = result[result.length - 1].las
        const currentTime = result[result.length - 1].datetime?.slice(11,16)
        const thresholds = getThresholdsForStationAndTime(config, station, currentTime || '00:00')
        const now = Date.now()
        // Check if we should show an alert (avoid spam - only alert once per 5 minutes per threshold)
        if (currentLevel >= thresholds.alarm && (currentLevel !== lastAlertRef.current.level || now - lastAlertRef.current.time > 300000)) {
          const hasPermission = await requestNotificationPermission()
          if (hasPermission) {
            showNoiseAlert(station, currentLevel, thresholds.alarm)
            lastAlertRef.current = { level: currentLevel, time: now }
          }
        } else if (currentLevel >= thresholds.warning && currentLevel < thresholds.alarm && (currentLevel !== lastAlertRef.current.level || now - lastAlertRef.current.time > 300000)) {
          const hasPermission = await requestNotificationPermission()
          if (hasPermission) {
            showNoiseAlert(station, currentLevel, thresholds.warning)
            lastAlertRef.current = { level: currentLevel, time: now }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching station data:', e)
    }
  }

  useEffect(() => {
    fetchAndProcess()
    intervalRef.current = setInterval(fetchAndProcess, 60_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station, interval, granularity, page, pageSize])

  return { data, totalCount }
} 