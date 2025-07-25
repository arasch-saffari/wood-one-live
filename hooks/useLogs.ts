import { useEffect, useState } from "react"

export function useLogs(pollInterval = 60000) {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let interval: NodeJS.Timeout | null = null
    async function fetchLogs() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/logs')
        if (!res.ok) throw new Error('Fehler beim Laden der Logs')
        const data = await res.json()
        if (mounted) setLogs(data.lines || [])
      } catch (e: unknown) {
        if (mounted) setError(e instanceof Error ? e.message : 'Fehler beim Laden der Logs')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchLogs()
    interval = setInterval(fetchLogs, pollInterval)
    // SSE-Integration für Delta-Updates
    const es = new EventSource('/api/updates')
    es.addEventListener('update', () => {
      fetchLogs()
    })
    return () => {
      mounted = false
      if (interval) clearInterval(interval)
      es.close()
    }
  }, [pollInterval])

  return { logs, loading, error }
} 