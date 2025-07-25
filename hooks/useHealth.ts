import { useEffect, useState } from "react"

// EventSource-Singleton für Delta-Updates
let globalEventSource: EventSource | null = null;
let globalEventSourceListeners = 0;

export function useHealth(pollInterval = 60000) {
  const [health, setHealth] = useState<unknown>(null)
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
      } catch (e: unknown) {
        if (mounted) setError(e instanceof Error ? e.message : 'Fehler beim Laden der Systemdaten')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchHealth()
    interval = setInterval(fetchHealth, pollInterval)
    // EventSource: Nur eine Instanz pro Seite, Listener zählen
    if (!globalEventSource) {
      globalEventSource = new EventSource('/api/updates')
    }
    const handler = () => fetchHealth()
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
  }, [pollInterval])

  return { health, loading, error }
} 