import { useEffect, useState } from "react"

export interface WeatherData {
  windSpeed?: number
  windDir?: string | number
  relHumidity?: number
  temperature?: number | null
  noWeatherData?: boolean
}

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
      } catch (e: any) {
        if (mounted) setError(e.message || "Fehler beim Laden der Wetterdaten")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchWeather()
    interval = setInterval(fetchWeather, pollInterval)
    return () => {
      mounted = false
      if (interval) clearInterval(interval)
    }
  }, [station, time, pollInterval])

  return { weather, loading, error }
} 