import { useEffect, useState } from "react"

export interface WeatherData {
  windSpeed?: number
  windDir?: string | number
  relHumidity?: number
  temperature?: number | null
  noWeatherData?: boolean
}

// EventSource-Singleton für Delta-Updates
let globalEventSource: EventSource | null = null;
let globalEventSourceListeners = 0;

export function useWeatherData(station: string = "global", time: string = "now", pollInterval = 60000) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let interval: NodeJS.Timeout | null = null
    async function fetchWeather() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/weather?station=${station}&time=${time}`)
        if (!res.ok) throw new Error("Fehler beim Laden der Wetterdaten")
        const data = await res.json()
        if (mounted) setWeather(data)
      } catch (e: unknown) {
        if (mounted) setError(e instanceof Error ? e.message : "Fehler beim Laden der Wetterdaten")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchWeather()
    interval = setInterval(fetchWeather, pollInterval)
    // EventSource: Nur eine Instanz pro Seite, Listener zählen
    if (!globalEventSource) {
      globalEventSource = new EventSource('/api/updates')
    }
    const handler = () => fetchWeather()
    globalEventSource.addEventListener('update', handler)
    globalEventSourceListeners++
    return () => {
      mounted = false
      if (interval) clearInterval(interval)
      if (globalEventSource) {
        globalEventSource.removeEventListener('update', handler)
        globalEventSourceListeners--
        if (globalEventSourceListeners <= 0) {
          globalEventSource.close()
          globalEventSource = null
        }
      }
    }
  }, [station, time, pollInterval])

  return { weather, loading, error }
} 