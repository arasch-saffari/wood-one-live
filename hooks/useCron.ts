import { useEffect, useState } from "react"

export function useCron(pollInterval = 60000) {
  const [cron, setCron] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let interval: NodeJS.Timeout | null = null
    async function fetchCron() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/cron')
        if (!res.ok) throw new Error('Fehler beim Laden der Cron-Daten')
        const data = await res.json()
        if (mounted) setCron(data)
      } catch (e: any) {
        if (mounted) setError(e.message || 'Fehler beim Laden der Cron-Daten')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchCron()
    interval = setInterval(fetchCron, pollInterval)
    return () => {
      mounted = false
      if (interval) clearInterval(interval)
    }
  }, [pollInterval])

  return { cron, loading, error }
} 