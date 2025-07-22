import { useEffect, useState } from "react"

export interface CsvWatcherStatus {
  watcherActive: boolean
  watchedDirectories: Array<{
    station: string
    path: string
    files: Array<{ name: string; size: number; modified: string; path: string }>
    fileCount: number
  }>
  totalFiles: number
  lastCheck: string
  watcherHeartbeat?: string
}

export function useCsvWatcherStatus(pollInterval = 60000) {
  const [status, setStatus] = useState<CsvWatcherStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let interval: NodeJS.Timeout | null = null
    async function fetchStatus() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/csv-watcher-status')
        if (!res.ok) throw new Error('Fehler beim Laden des CSV-Watcher-Status')
        const data = await res.json()
        if (mounted) setStatus(data)
      } catch (e: any) {
        if (mounted) setError(e.message || 'Fehler beim Laden des CSV-Watcher-Status')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchStatus()
    interval = setInterval(fetchStatus, pollInterval)
    return () => {
      mounted = false
      if (interval) clearInterval(interval)
    }
  }, [pollInterval])

  return { watcherStatus: status, loading, error }
} 