import { useEffect, useState } from "react"

export function useHealth(pollInterval = 60000) {
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let interval: NodeJS.Timeout | null = null
    async function fetchHealth() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/health')
        if (!res.ok) throw new Error('Fehler beim Laden der Systemdaten')
        const data = await res.json()
        if (mounted) setHealth(data)
      } catch (e: any) {
        if (mounted) setError(e.message || 'Fehler beim Laden der Systemdaten')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchHealth()
    interval = setInterval(fetchHealth, pollInterval)
    return () => {
      mounted = false
      if (interval) clearInterval(interval)
    }
  }, [pollInterval])

  return { health, loading, error }
} 