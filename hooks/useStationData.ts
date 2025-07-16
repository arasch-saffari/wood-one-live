import { useEffect, useRef, useState } from "react"
import Papa from "papaparse"
import { roundTo5MinBlock } from "@/lib/utils"

export interface StationDataPoint {
  time: string // "HH:MM"
  las: number
  ws?: number // wind speed
  wd?: string  // wind direction
  rh?: number  // relative humidity
}

// Request notification permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications')
    return false
  }
  
  if (Notification.permission === 'granted') {
    return true
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  
  return false
}

// Show expressive notification
function showNoiseAlert(station: string, level: number, threshold: number) {
  const stationNames: Record<string, string> = {
    'ort': 'Standort Ort',
    'techno': 'Techno Floor',
    'heuballern': 'Heuballern',
    'band': 'Band',
    'triple': 'Triple'
  }
  
  const stationName = stationNames[station] || station
  
  const notification = new Notification(`🚨 LÄRMALARM - ${stationName}`, {
    body: `Grenzwert überschritten! Aktueller Pegel: ${level.toFixed(1)} dB (Grenze: ${threshold} dB)`,
    icon: '/alert-icon.png',
    tag: `noise-alert-${station}`,
    requireInteraction: true,
    silent: false
  })
  
  // Handle notification clicks
  notification.onclick = () => {
    window.focus()
    notification.close()
    // Navigate to the specific station dashboard
    window.location.href = `/dashboard/${station}`
  }
  
  // Auto-close after 10 seconds
  setTimeout(() => {
    notification.close()
  }, 10000)
}

export function useStationData(station: string, interval: "24h" | "7d" = "24h") {
  const [data, setData] = useState<StationDataPoint[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastAlertRef = useRef<{ level: number; time: number }>({ level: 0, time: 0 })

  async function fetchAndProcess() {
    try {
      // 1. Get latest CSV file name
      const res = await fetch(`/api/${station}/latest-csv`)
      if (!res.ok) return
      const { file } = await res.json()
      if (!file) return

      // 2. Fetch CSV file
      const csvRes = await fetch(`/csv/${station}/${file}`)
      if (!csvRes.ok) return
      const csvText = await csvRes.text()

      // 3. Parse CSV
      const parsed = Papa.parse(csvText, {
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
      })
      let rows = parsed.data as Record<string, string>[]
      if (!Array.isArray(rows) || rows.length < 2) return
      rows = rows.slice(1) // drop first row

      // 4. Determine the correct column name for noise level based on station
      const noiseColumn = station === "heuballern" ? "LAF" : "LAS"

      // 5. Validate and process rows
      const validRows = rows.filter(
        (row) =>
          row["Systemzeit "] &&
          row[noiseColumn] &&
          !isNaN(Number(row[noiseColumn].replace(",", ".")))
      )

      // 6. Aggregate into 15-min blocks
      const blocks: { [block: string]: number[] } = {}
      validRows.forEach((row) => {
        const sysTime = row["Systemzeit "]?.trim()
        const las = Number(row[noiseColumn].replace(",", "."))
        if (!sysTime || isNaN(las)) return
        // Parse time as HH:MM:SS:MS, use only HH:MM
        const [h, m] = sysTime.split(":")
        if (!h || !m) return
        const blockTime = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`
        if (!blocks[blockTime]) blocks[blockTime] = []
        blocks[blockTime].push(las)
      })
      // 7. Für alle Blöcke: Wetterdaten im Batch holen
      const blockTimes = Object.keys(blocks).sort()
      const weatherBlocks = blockTimes.map(t => roundTo5MinBlock(t))
      const uniqueWeatherBlocks = Array.from(new Set(weatherBlocks))
      let weatherMap: Record<string, any> = {}
      try {
        const batchRes = await fetch(`/api/weather/batch?station=${encodeURIComponent(station)}&times=${uniqueWeatherBlocks.join(",")}`)
        if (batchRes.ok) {
          weatherMap = await batchRes.json()
        }
      } catch (e) {
        // ignore weather errors
      }
      // 8. Ergebnis bauen
      const result: StationDataPoint[] = []
      for (const time of blockTimes) {
        const lasArr = blocks[time]
        const las = Number((lasArr.reduce((a, b) => a + b, 0) / lasArr.length).toFixed(2))
        const weather = weatherMap[roundTo5MinBlock(time)] || {}
        result.push({
          time,
          las,
          ws: weather.windSpeed,
          wd: weather.windDir,
          rh: weather.relHumidity,
        })
      }
      // Anzahl der Blöcke je nach Intervall
      const keepBlocks = interval === "7d" ? 672 : 40
      const newData = result.slice(-keepBlocks)
      setData(newData)
      
      // 9. Check for noise alerts
      if (newData.length > 0) {
        const currentLevel = newData[newData.length - 1].las
        const now = Date.now()
        
        // Check if we should show an alert (avoid spam - only alert once per 5 minutes per threshold)
        if (currentLevel >= 60 && (currentLevel !== lastAlertRef.current.level || now - lastAlertRef.current.time > 300000)) {
          const hasPermission = await requestNotificationPermission()
          if (hasPermission) {
            showNoiseAlert(station, currentLevel, 60)
            lastAlertRef.current = { level: currentLevel, time: now }
          }
        } else if (currentLevel >= 55 && currentLevel < 60 && (currentLevel !== lastAlertRef.current.level || now - lastAlertRef.current.time > 300000)) {
          const hasPermission = await requestNotificationPermission()
          if (hasPermission) {
            showNoiseAlert(station, currentLevel, 55)
            lastAlertRef.current = { level: currentLevel, time: now }
          }
        }
      }
    } catch (e) {
      // Optionally handle error
    }
  }

  useEffect(() => {
    fetchAndProcess()
    intervalRef.current = setInterval(fetchAndProcess, 60_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station, interval])

  return data
} 