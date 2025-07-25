import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

function parsePrometheusMetrics(metricsText: string) {
  const lines = metricsText.split('\n')
  const result: Record<string, number> = {}
  for (const line of lines) {
    if (line.startsWith('#')) continue
    const [key, value] = line.split(' ')
    if (key && value && !isNaN(Number(value))) {
      result[key] = Number(value)
    }
  }
  return result
}

function ImportStatusBadge({ value }: { value: number | undefined }) {
  if (typeof value !== 'number' || isNaN(value)) return null
  let color = 'bg-emerald-100 text-emerald-700 border-emerald-200'
  let label = 'OK'
  if (value > 10) {
    color = 'bg-red-100 text-red-700 border-red-200'
    label = 'Alarm'
  } else if (value > 5) {
    color = 'bg-yellow-100 text-yellow-700 border-yellow-200'
    label = 'Warnung'
  }
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${color} ml-2`}>{label}</span>
}

function ApiLatencyStatusBadge({ value }: { value: number | undefined }) {
  if (typeof value !== 'number' || isNaN(value)) return null
  let color = 'bg-emerald-100 text-emerald-700 border-emerald-200'
  let label = 'OK'
  if (value > 1) {
    color = 'bg-red-100 text-red-700 border-red-200'
    label = 'Alarm'
  } else if (value > 0.5) {
    color = 'bg-yellow-100 text-yellow-700 border-yellow-200'
    label = 'Warnung'
  }
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${color} ml-2`}>{label}</span>
}

function ErrorCounterStatusBadge({ value }: { value: number | undefined }) {
  if (typeof value !== 'number' || isNaN(value)) return null
  let color = 'bg-emerald-100 text-emerald-700 border-emerald-200'
  let label = 'OK'
  if (value > 5) {
    color = 'bg-red-100 text-red-700 border-red-200'
    label = 'Alarm'
  } else if (value > 0) {
    color = 'bg-yellow-100 text-yellow-700 border-yellow-200'
    label = 'Warnung'
  }
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${color} ml-2`}>{label}</span>
}

export function AdminMonitoringPanel() {
  const [metrics, setMetrics] = useState<Record<string, number>>({})
  const [importHistory, setImportHistory] = useState<number[]>([])
  const [latencyHistory, setLatencyHistory] = useState<number[]>([])
  const [errorHistory, setErrorHistory] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true
    async function fetchMetrics() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/metrics')
        if (!res.ok) throw new Error('Fehler beim Laden der Metriken')
        const text = await res.text()
        const parsed = parsePrometheusMetrics(text)
        if (mounted) {
          setMetrics(parsed)
          if (parsed['csv_import_duration_seconds'] !== undefined) {
            setImportHistory(prev => {
              const next = [...prev, parsed['csv_import_duration_seconds']]
              return next.slice(-10)
            })
          }
          if (parsed['api_request_duration_seconds_sum'] !== undefined && parsed['api_request_duration_seconds_count'] !== undefined && parsed['api_request_duration_seconds_count'] > 0) {
            const avg = parsed['api_request_duration_seconds_sum']/parsed['api_request_duration_seconds_count']
            setLatencyHistory(prev => {
              const next = [...prev, avg]
              return next.slice(-10)
            })
          }
          if (parsed['app_errors_total'] !== undefined) {
            setErrorHistory(prev => {
              const next = [...prev, parsed['app_errors_total']]
              return next.slice(-10)
            })
          }
        }
      } catch (e: unknown) {
        if (mounted) setError(e instanceof Error ? e.message : 'Fehler beim Laden der Metriken')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 30000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])
  if (loading) return <div>Lädt Monitoring ...</div>
  if (error) return <div className="text-red-500">{error}</div>
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader><CardTitle>Importdauer</CardTitle></CardHeader>
        <CardContent>
          <span className="text-2xl font-bold">{metrics['csv_import_duration_seconds']?.toFixed(2) ?? '–'} s</span>
          <ImportStatusBadge value={metrics['csv_import_duration_seconds']} />
          <div className="h-24 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={importHistory.map((v, i) => ({ i, v }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="i" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip formatter={v => `${v} s`} labelFormatter={i => `Import #${i+1}`} />
                <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>API-Latenz (station-data)</CardTitle></CardHeader>
        <CardContent>
          <span className="text-2xl font-bold">{metrics['api_request_duration_seconds_sum'] && metrics['api_request_duration_seconds_count'] ? (metrics['api_request_duration_seconds_sum']/metrics['api_request_duration_seconds_count']).toFixed(3) : '–'} s</span>
          <ApiLatencyStatusBadge value={metrics['api_request_duration_seconds_sum'] && metrics['api_request_duration_seconds_count'] ? metrics['api_request_duration_seconds_sum']/metrics['api_request_duration_seconds_count'] : undefined} />
          <div className="h-24 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latencyHistory.map((v, i) => ({ i, v }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="i" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip formatter={v => `${v} s`} labelFormatter={i => `Request #${i+1}`} />
                <Line type="monotone" dataKey="v" stroke="#f59e42" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Datenbankgröße</CardTitle></CardHeader>
        <CardContent>
          <span className="text-2xl font-bold">{metrics['db_file_size_bytes'] ? (metrics['db_file_size_bytes']/1024/1024).toFixed(2) : '–'} MB</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Fehlerzähler</CardTitle></CardHeader>
        <CardContent>
          <span className="text-2xl font-bold">{metrics['app_errors_total'] ?? 0}</span>
          <ErrorCounterStatusBadge value={metrics['app_errors_total']} />
          <div className="h-24 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={errorHistory.map((v, i) => ({ i, v }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="i" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip formatter={v => `${v}`} labelFormatter={i => `Messung #${i+1}`} />
                <Line type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 