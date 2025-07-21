"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Database, FileText, Activity, Eye, Upload, Download, UploadCloud, AlertTriangle, HardDrive, Cloud, Database as DbIcon, Pencil, Trash2, Terminal, BarChart3, Clock, Settings } from "lucide-react"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { useToast } from '@/components/ui/use-toast'

interface CSVFile {
  name: string
  size: number
  modified: string
  path: string
}

interface WatchedDirectory {
  station: string
  path: string
  files: CSVFile[]
  fileCount: number
}

interface WatcherStatus {
  watcherActive: boolean
  watchedDirectories: WatchedDirectory[]
  totalFiles: number
  lastCheck: string
}

export default function AdminPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<{ success: boolean; error?: string; message?: string; processedFiles?: number } | null>(null)
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatus | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const [weatherTestResult, setWeatherTestResult] = useState<{ success: boolean; error?: string; time?: string } | null>(null)
  const [resetting, setResetting] = useState(false)
  const [recentActions, setRecentActions] = useState<Array<{ type: string; time: string; message: string }>>([])
  const { toast } = useToast();
  const fileInputRefs = useRef<{ [station: string]: HTMLInputElement | null }>({})
  const [uploading, setUploading] = useState<{ [station: string]: boolean }>({})
  const dbRestoreInputRef = useRef<HTMLInputElement | null>(null)
  const [dbUploading, setDbUploading] = useState(false)
  const [logLines, setLogLines] = useState<string[]>([])
  const [logLevel, setLogLevel] = useState<string>('')
  const [logLoading, setLogLoading] = useState(false)
  const logEndRef = useRef<HTMLDivElement | null>(null)
  const [health, setHealth] = useState<any>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [dataType, setDataType] = useState<'measurements' | 'weather'>('measurements')
  const [dataStation, setDataStation] = useState<string>('')
  const [dataRows, setDataRows] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [editRow, setEditRow] = useState<any | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST' | 'PATCH' | 'DELETE'>('GET')
  const [apiUrl, setApiUrl] = useState<string>('/api/station-data?station=ort')
  const [apiBody, setApiBody] = useState<string>('')
  const [apiResult, setApiResult] = useState<any>(null)
  const [apiLoading, setApiLoading] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [crons, setCrons] = useState<any[]>([])
  const [cronsLoading, setCronsLoading] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [watcherHeartbeat, setWatcherHeartbeat] = useState<string | null>(null)
  const [watcherHeartbeatAgo, setWatcherHeartbeatAgo] = useState<string | null>(null)

  useEffect(() => {
    setRecentActions([
      { type: 'Watcher', time: new Date().toLocaleString('de-DE'), message: 'System gestartet' },
    ])
  }, [])

  const processCSVFiles = async () => {
    setIsProcessing(true)
    try {
      const response = await fetch('/api/process-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const result = await response.json()
      setLastResult(result)
      
      if (result.success) {
        console.log('✅ CSV processing completed:', result)
        // Refresh status after processing
        fetchWatcherStatus()
      } else {
        console.error('❌ CSV processing failed:', result)
      }
    } catch (error) {
      console.error('❌ Error processing CSV:', error)
      setLastResult({ success: false, error: 'Network error' })
    } finally {
      setIsProcessing(false)
    }
  }

  const fetchWatcherStatus = async () => {
    setIsLoadingStatus(true)
    try {
      const response = await fetch('/api/csv-watcher-status')
      const status = await response.json()
      setWatcherStatus(status)
      if (status.watcherHeartbeat) {
        setWatcherHeartbeat(status.watcherHeartbeat)
        // Zeitdifferenz berechnen
        const last = new Date(status.watcherHeartbeat)
        const now = new Date()
        const diffMin = Math.floor((now.getTime() - last.getTime()) / 60000)
        if (diffMin < 1) setWatcherHeartbeatAgo('gerade eben')
        else if (diffMin === 1) setWatcherHeartbeatAgo('vor 1 Min')
        else setWatcherHeartbeatAgo(`vor ${diffMin} Min`)
      } else {
        setWatcherHeartbeat(null)
        setWatcherHeartbeatAgo(null)
      }
    } catch (error) {
      console.error('❌ Error fetching watcher status:', error)
    } finally {
      setIsLoadingStatus(false)
    }
  }

  const testWeatherFetch = async () => {
    setWeatherTestResult(null)
    try {
      const now = new Date()
      const iso = now.toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM
      // API erwartet ?station=global&time=YYYY-MM-DDTHH:MM
      const url = `/api/weather?station=global&time=${encodeURIComponent(iso.replace('T', ' '))}`
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok && data && (data.windSpeed !== undefined || data.ws !== undefined)) {
        setWeatherTestResult({ success: true, time: iso.replace('T', ' ') })
      } else {
        setWeatherTestResult({ success: false, error: data?.error || 'Unbekannter Fehler' })
      }
    } catch (e: any) {
      setWeatherTestResult({ success: false, error: e?.message || 'Fehler beim Fetch' })
    }
  }

  const handleFactoryReset = async () => {
    if (!window.confirm('Wirklich ALLE Daten (Messwerte, Wetter, CSVs) löschen und System zurücksetzen?')) return;
    setResetting(true)
    try {
      // API-Route zum Löschen und Re-Init anstoßen
      const res = await fetch('/api/admin/factory-reset', { method: 'POST' })
      const data = await res.json()
      alert(data.message || 'Zurücksetzen abgeschlossen.')
      // Optional: Seite neu laden
      window.location.reload()
    } catch (e) {
      alert('Fehler beim Zurücksetzen: ' + (e?.message || e))
    } finally {
      setResetting(false)
    }
  }

  const rebuildDatabase = async () => {
    if (!window.confirm('Wirklich ALLE Messwerte und Wetterdaten löschen und die Datenbank neu aufbauen?')) return;
    setResetting(true)
    try {
      const res = await fetch('/api/admin/rebuild-db', { method: 'POST' })
      const data = await res.json()
      toast({
        title: 'Neuaufbau abgeschlossen',
        description: data.message || 'Die Datenbank und Wetterdaten wurden erfolgreich neu aufgebaut.',
        variant: 'default',
      })
      setTimeout(() => {
        window.location.reload()
      }, 1200)
    } catch (e) {
      toast({
        title: 'Fehler beim Neuaufbau',
        description: (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e)) as string,
        variant: 'destructive',
      })
    } finally {
      setResetting(false)
    }
  }

  // CSV-Upload-Handler
  const handleCsvUpload = async (station: string, file: File) => {
    setUploading((prev) => ({ ...prev, [station]: true }))
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('station', station)
      const res = await fetch('/api/admin/upload-csv', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({
          title: 'Upload erfolgreich',
          description: data.message || `${file.name} wurde hochgeladen und verarbeitet.`,
          variant: 'default',
        })
        fetchWatcherStatus()
      } else {
        toast({
          title: 'Fehler beim Upload',
          description: data.message || 'Unbekannter Fehler',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Fehler beim Upload',
        description: (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e)) as string,
        variant: 'destructive',
      })
      showErrorNotification('Fehler beim Upload', (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e)))
    } finally {
      setUploading((prev) => ({ ...prev, [station]: false }))
    }
  }

  // Drag & Drop Handler
  const handleDrop = (station: string, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.name.endsWith('.csv')) {
        handleCsvUpload(station, file)
      } else {
        toast({ title: 'Nur CSV-Dateien erlaubt', variant: 'destructive' })
      }
    }
  }
  const handleFileInput = (station: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleCsvUpload(station, file)
  }

  // Backup-Download
  const handleDbDownload = () => {
    window.open('/api/admin/backup-db', '_blank')
  }
  // Restore-Upload
  const handleDbRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setDbUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/admin/restore-db', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'Restore erfolgreich', description: data.message, variant: 'default' })
        setTimeout(() => window.location.reload(), 1200)
      } else {
        toast({ title: 'Fehler beim Restore', description: data.message, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Fehler beim Restore', description: (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e)) as string, variant: 'destructive' })
      showErrorNotification('Fehler beim Restore', (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e)))
    } finally {
      setDbUploading(false)
    }
  }

  const fetchLogs = useCallback(async (level?: string) => {
    setLogLoading(true)
    try {
      const url = '/api/admin/logs' + (level ? `?level=${level}` : '')
      const res = await fetch(url)
      const data = await res.json()
      setLogLines(data.lines || [])
      setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {}
    setLogLoading(false)
  }, [])
  useEffect(() => { fetchLogs(logLevel) }, [logLevel, fetchLogs])

  const fetchHealth = async () => {
    setHealthLoading(true)
    try {
      const res = await fetch('/api/admin/health')
      const data = await res.json()
      setHealth(data)
    } catch {}
    setHealthLoading(false)
  }
  useEffect(() => { fetchHealth() }, [])

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/admin/stats')
      const data = await res.json()
      setStats(data)
    } catch {}
    setStatsLoading(false)
  }
  useEffect(() => { fetchStats() }, [])

  const fetchCrons = async () => {
    setCronsLoading(true)
    try {
      const res = await fetch('/api/admin/cron')
      const data = await res.json()
      setCrons(data.crons || [])
    } catch {}
    setCronsLoading(false)
  }
  useEffect(() => { fetchCrons() }, [])

  const fetchConfig = async () => {
    setConfigLoading(true)
    try {
      const res = await fetch('/api/admin/config')
      const data = await res.json()
      setConfig(data)
    } catch {}
    setConfigLoading(false)
  }
  useEffect(() => { fetchConfig() }, [])
  const handleConfigChange = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }))
  }
  const handleConfigSave = async () => {
    setConfigSaving(true)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'Konfiguration gespeichert', variant: 'default' })
      } else {
        toast({ title: 'Fehler beim Speichern', description: data.message, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Fehler beim Speichern', description: (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e)) as string, variant: 'destructive' })
      showErrorNotification('Fehler beim Speichern', (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e)))
    }
    setConfigSaving(false)
  }

  useEffect(() => {
    fetchWatcherStatus()
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE')
  }

  // Hilfsfunktion für Berlin-Zeit (auch für 'HH:MM')
  function formatBerlinTime(iso: string | null | undefined): string {
    if (!iso) return '-';
    if (/^\d{2}:\d{2}$/.test(iso)) {
      // Nur Uhrzeit, baue Date-Objekt für heute
      const now = new Date();
      const [h, m] = iso.split(':').map(Number);
      const berlin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
      return berlin.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
    }
    const date = new Date(iso);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  }

  // Hilfsfunktion für DB-Größe (Dummy, kann später per API ergänzt werden)
  const [dbSize, setDbSize] = useState<string>('–')
  useEffect(() => {
    // Optional: Hole DB-Größe per API
    setDbSize('ca. 1 MB')
  }, [])

  const fetchDataRows = async () => {
    setDataLoading(true)
    try {
      const url = `/api/admin/data?type=${dataType}&station=${dataStation}&limit=50`
      const res = await fetch(url)
      const data = await res.json()
      setDataRows(data.rows || [])
    } catch {}
    setDataLoading(false)
  }
  useEffect(() => { fetchDataRows() }, [dataType, dataStation])
  // Bearbeiten
  const handleEditSave = async () => {
    if (!editRow) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/admin/data?type=${dataType}&id=${editRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRow),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'Gespeichert', variant: 'default' })
        setEditRow(null)
        fetchDataRows()
      } else {
        toast({ title: 'Fehler beim Speichern', description: data.message, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Fehler beim Speichern', description: (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e)) as string, variant: 'destructive' })
      showErrorNotification('Fehler beim Speichern', (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e)))
    }
    setEditSaving(false)
  }
  // Löschen
  const handleDelete = async (id: string) => {
    if (!window.confirm('Wirklich löschen?')) return
    try {
      const res = await fetch(`/api/admin/data?type=${dataType}&id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'Gelöscht', variant: 'default' })
        fetchDataRows()
      } else {
        toast({ title: 'Fehler beim Löschen', description: data.message, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Fehler beim Löschen', description: (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e)) as string, variant: 'destructive' })
      showErrorNotification('Fehler beim Löschen', (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e)))
    }
  }

  const handleApiTest = async () => {
    setApiLoading(true)
    setApiResult(null)
    try {
      const res = await fetch(apiUrl, {
        method: apiMethod,
        headers: apiMethod !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
        body: apiMethod !== 'GET' && apiBody ? apiBody : undefined,
      })
      const text = await res.text()
      let json = null
      try { json = JSON.parse(text) } catch {}
      setApiResult({ status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()), body: json || text })
    } catch (e: any) {
      toast({ title: 'API-Fehler', description: (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e)) as string, variant: 'destructive' })
      showErrorNotification('API-Fehler', (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e)))
    }
    setApiLoading(false)
  }

  function showErrorNotification(title: string, message?: string) {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: message, icon: '/alert-icon.png' })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, { body: message, icon: '/alert-icon.png' })
          }
        })
      }
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-2 sm:px-4 md:px-0">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center space-x-3"
      >
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
          <Database className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Datenbankverwaltung und automatische CSV-Verarbeitung
          </p>
        </div>
      </motion.div>

      {/* Systemstatus */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="w-5 h-5 text-purple-500" /> Systemstatus
            </CardTitle>
            <Badge className="bg-green-500/20 text-green-700 border-green-500/30 font-medium">
              Online
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            <div><span className="font-medium">Watcher:</span> {watcherStatus?.watcherActive ? 'Aktiv' : 'Inaktiv'}</div>
            <div><span className="font-medium">CSV-Dateien:</span> {watcherStatus?.totalFiles ?? '–'}</div>
            <div><span className="font-medium">DB-Größe:</span> {dbSize}</div>
            <div><span className="font-medium">Letzte Verarbeitung:</span> {watcherStatus?.lastCheck ? formatDate(watcherStatus.lastCheck) : '–'}</div>
          </CardContent>
        </Card>
        {/* Letzte Aktionen */}
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Eye className="w-5 h-5 text-blue-500" /> Letzte Aktionen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {recentActions.slice(0, 3).map((a, i) => (
              <div key={i} className="flex justify-between">
                <span className="font-medium text-gray-700 dark:text-gray-200">{a.type}</span>
                <span className="text-gray-500">{a.time}</span>
                <span className="text-gray-500">{a.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* CSV-Ordner & Upload */}
      <Card className="bg-white/80 dark:bg-gray-900/60 border-0 shadow-md">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FileText className="w-5 h-5 text-purple-400" /> CSV-Dateien & Upload
          </CardTitle>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> CSV hochladen
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {watcherStatus?.watchedDirectories.map((dir) => (
            <div key={dir.station} className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-900 dark:text-white capitalize">{dir.station}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    disabled={uploading[dir.station]}
                    onClick={() => fileInputRefs.current[dir.station]?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    {uploading[dir.station] ? 'Lädt...' : 'CSV hochladen'}
                  </Button>
                  <input
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    ref={el => { fileInputRefs.current[dir.station] = el || null }}
                    onChange={e => handleFileInput(dir.station, e)}
                  />
                </div>
              </div>
              <div
                className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-2 mb-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(dir.station, e)}
              >
                CSV-Datei hierher ziehen oder Button nutzen.
              </div>
              <div className="text-xs text-gray-500 mb-1">{dir.path}</div>
              {dir.files.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {dir.files.slice(0, 3).map((file) => (
                    <div key={file.name} className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>{file.name}</span>
                      <span>{formatFileSize(file.size)} • {formatDate(file.modified)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-400">Keine Dateien vorhanden.</div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Aktionen: Verarbeitung, Wetter-Test, Reset */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-purple-100 to-purple-50 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <RefreshCw className="w-5 h-5 text-purple-500" /> Manuelle Verarbeitung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={processCSVFiles}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Verarbeite CSV-Dateien...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  CSV-Dateien verarbeiten
                </>
              )}
            </Button>
            {lastResult && (
              <div className={`p-3 mt-3 rounded-lg ${
                lastResult.success 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center space-x-2">
                  {lastResult.success ? (
                    <Activity className="w-4 h-4 text-green-500" />
                  ) : (
                    <Activity className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`font-medium ${
                    lastResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                  }`}>
                    {lastResult.success ? 'Erfolgreich verarbeitet' : 'Fehler bei der Verarbeitung'}
                  </span>
                </div>
                <p className={`text-xs mt-1 ${
                  lastResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {lastResult.message || lastResult.error}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-100 to-cyan-50 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="w-5 h-5 text-blue-500" /> Wetterdaten-Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold"
              onClick={testWeatherFetch}
            >
              Wetterdaten jetzt abrufen & speichern
            </Button>
            {weatherTestResult && (
              <div className={weatherTestResult.success ? 'text-green-600 mt-2' : 'text-red-600 mt-2'}>
                {weatherTestResult.success
                  ? `Erfolg: Wetterdaten für ${formatBerlinTime(weatherTestResult.time)} gespeichert.`
                  : `Fehler: ${weatherTestResult.error}`}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-100 to-yellow-50 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md col-span-1 sm:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-yellow-700 dark:text-yellow-300">
              <Activity className="w-5 h-5 text-yellow-500" /> Neuaufbau Datenbank & Wetterdaten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={rebuildDatabase} disabled={resetting} className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-semibold">
              {resetting ? 'Neuaufbau läuft...' : 'Datenbank & Wetterdaten löschen und neu aufbauen'}
            </Button>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-100 to-red-50 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md col-span-1 sm:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-red-700 dark:text-red-300">
              <Activity className="w-5 h-5 text-red-500" /> Werkseinstellungen / Factory Reset
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={handleFactoryReset} disabled={resetting} className="w-full bg-gradient-to-r from-red-500 to-red-700 text-white font-semibold">
              {resetting ? 'Zurücksetzen läuft...' : 'Datenbank & CSVs löschen und System zurücksetzen'}
            </Button>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-100 to-green-50 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md col-span-1 sm:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-green-700 dark:text-green-300">
              <Download className="w-5 h-5 text-green-500" /> Backup & Restore
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={handleDbDownload} className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold">
              <Download className="w-4 h-4" /> Backup herunterladen
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              disabled={dbUploading}
              onClick={() => dbRestoreInputRef.current?.click()}
            >
              <UploadCloud className="w-4 h-4" /> {dbUploading ? 'Lädt...' : 'Backup wiederherstellen'}
            </Button>
            <input
              type="file"
              accept=".sqlite"
              style={{ display: 'none' }}
              ref={dbRestoreInputRef}
              onChange={handleDbRestore}
            />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md col-span-1 sm:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="w-5 h-5 text-yellow-500" /> System Health
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchHealth} disabled={healthLoading}>
              <RefreshCw className={healthLoading ? 'animate-spin' : ''} />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            {!health && <div className="text-gray-400">Lade Health-Status...</div>}
            {health && (
              <>
                <div className="flex items-center gap-2"><DbIcon className="w-4 h-4" /> DB-Größe: <span className="font-mono">{(health.dbSize / 1024 / 1024).toFixed(2)} MB</span></div>
                <div className="flex items-center gap-2"><HardDrive className="w-4 h-4" /> Speicher frei: <span className="font-mono">{health.diskFree ? (health.diskFree / 1024 / 1024 / 1024).toFixed(2) : '?'} GB</span> / Gesamt: <span className="font-mono">{health.diskTotal ? (health.diskTotal / 1024 / 1024 / 1024).toFixed(2) : '?' } GB</span></div>
                <div className="flex items-center gap-2"><Cloud className="w-4 h-4" /> Wetter-API: <span className="font-mono">{health.lastWeather || '-'}</span></div>
                <div className="flex items-center gap-2"><Activity className="w-4 h-4" /> Watcher: <span className={health.watcherActive ? 'text-green-600' : 'text-red-600'}>{health.watcherActive ? 'Aktiv' : 'Inaktiv'}</span></div>
                <div className="flex items-center gap-2"><span className="font-mono">{health.time}</span></div>
                {watcherHeartbeat && <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" /> Watcher Heartbeat: <span className="font-mono">{new Date(watcherHeartbeat).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Berlin' })}</span> <span className="text-xs text-gray-500">({watcherHeartbeatAgo})</span></div>}
                {health.error && <div className="text-red-600">Fehler: {health.error}</div>}
              </>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md col-span-1 sm:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-700 dark:text-gray-300">
              <Activity className="w-5 h-5 text-gray-500" /> System-Logs
            </CardTitle>
            <div className="flex gap-2">
              <select
                className="rounded border px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                value={logLevel}
                onChange={e => setLogLevel(e.target.value)}
              >
                <option value="">Alle</option>
                <option value="info">Info</option>
                <option value="warn">Warnung</option>
                <option value="error">Fehler</option>
              </select>
              <Button variant="outline" size="sm" onClick={() => fetchLogs(logLevel)} disabled={logLoading}>
                <RefreshCw className={logLoading ? 'animate-spin' : ''} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="bg-black text-green-100 font-mono text-xs rounded-lg p-2 max-h-64 overflow-auto">
            {logLines.length === 0 && <div className="text-gray-400">Keine Logs gefunden.</div>}
            {logLines.map((line, i) => <div key={i}>{line}</div>)}
            <div ref={logEndRef} />
          </CardContent>
        </Card>
      </div>

      {/* Datenkorrektur */}
      <Card className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md col-span-1 sm:col-span-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-300">
            <Pencil className="w-5 h-5 text-slate-500" /> Datenkorrektur
          </CardTitle>
          <div className="flex gap-2">
            <select className="rounded border px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200" value={dataType} onChange={e => setDataType(e.target.value as any)}>
              <option value="measurements">Messwerte</option>
              <option value="weather">Wetterdaten</option>
            </select>
            <select className="rounded border px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200" value={dataStation} onChange={e => setDataStation(e.target.value)}>
              <option value="">Alle Stationen</option>
              <option value="ort">Ort</option>
              <option value="techno">Techno</option>
              <option value="band">Band</option>
              <option value="heuballern">Heuballern</option>
            </select>
            <Button variant="outline" size="sm" onClick={fetchDataRows} disabled={dataLoading}>
              <RefreshCw className={dataLoading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {dataLoading && <div className="text-gray-400">Lade Daten...</div>}
          {!dataLoading && dataRows.length === 0 && <div className="text-gray-400">Keine Daten gefunden.</div>}
          {!dataLoading && dataRows.length > 0 && (
            <table className="min-w-full text-xs">
              <thead>
                <tr>
                  {Object.keys(dataRows[0]).map(key => <th key={key} className="px-2 py-1 text-left font-semibold text-slate-600 dark:text-slate-300">{key}</th>)}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dataRows.map(row => (
                  <tr key={row.id} className={editRow?.id === row.id ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''}>
                    {Object.keys(row).map(key => (
                      <td key={key} className="px-2 py-1">
                        {editRow?.id === row.id ? (
                          <input
                            className="border rounded px-1 py-0.5 text-xs w-24 bg-white dark:bg-gray-800"
                            value={editRow[key] ?? ''}
                            onChange={e => setEditRow({ ...editRow, [key]: e.target.value })}
                            disabled={key === 'id'}
                          />
                        ) : (
                          row[key]
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-1 flex gap-1">
                      {editRow?.id === row.id ? (
                        <>
                          <Button size="sm" variant="outline" onClick={handleEditSave} disabled={editSaving}>Speichern</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditRow(null)}>Abbrechen</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEditRow(row)}><Pencil className="w-3 h-3" /></Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(row.id)}><Trash2 className="w-3 h-3" /></Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* API-Test-Tool */}
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md col-span-1 sm:col-span-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-300">
            <Terminal className="w-5 h-5 text-slate-500" /> API-Test-Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <select className="rounded border px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200" value={apiMethod} onChange={e => setApiMethod(e.target.value as any)}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
            <input className="border rounded px-2 py-1 text-xs w-64 bg-white dark:bg-gray-800" value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="/api/..." />
            <Button variant="outline" size="sm" onClick={handleApiTest} disabled={apiLoading}>
              <RefreshCw className={apiLoading ? 'animate-spin' : ''} /> Senden
            </Button>
          </div>
          {(apiMethod === 'POST' || apiMethod === 'PATCH') && (
            <textarea className="border rounded px-2 py-1 text-xs w-full bg-white dark:bg-gray-800 font-mono" rows={3} value={apiBody} onChange={e => setApiBody(e.target.value)} placeholder="JSON-Body" />
          )}
          {apiResult && (
            <div className="bg-black text-green-100 font-mono text-xs rounded-lg p-2 max-h-64 overflow-auto mt-2">
              <div>Status: {apiResult.status} {apiResult.statusText}</div>
              <div>Headers: {JSON.stringify(apiResult.headers, null, 2)}</div>
              <div>Body:</div>
              <pre className="whitespace-pre-wrap break-all">{typeof apiResult.body === 'string' ? apiResult.body : JSON.stringify(apiResult.body, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistiken */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md col-span-1 sm:col-span-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-blue-700 dark:text-blue-300">
            <BarChart3 className="w-5 h-5 text-blue-500" /> Statistiken
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={statsLoading}>
            <RefreshCw className={statsLoading ? 'animate-spin' : ''} />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-xs">
          {!stats && <div className="text-gray-400">Lade Statistiken...</div>}
          {stats && !stats.error && (
            <>
              <div className="flex items-center gap-2">Messwerte: <span className="font-mono">{stats.measurements}</span></div>
              <div className="flex items-center gap-2">Wetterdaten: <span className="font-mono">{stats.weather}</span></div>
              <div className="flex items-center gap-2">DB-Größe: <span className="font-mono">{(stats.dbSize / 1024 / 1024).toFixed(2)} MB</span></div>
              <div className="flex items-center gap-2">CSV-Dateien pro Station:</div>
              <ul className="ml-4">
                {Object.entries(stats.csvCounts).map(([station, count]) => (
                  <li key={station}>{station}: <span className="font-mono">{count as any}</span></li>
                ))}
              </ul>
            </>
          )}
          {stats && stats.error && <div className="text-red-600">Fehler: {stats.error}</div>}
        </CardContent>
      </Card>

      {/* Cron-Übersicht */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md col-span-1 sm:col-span-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-purple-700 dark:text-purple-300">
            <Clock className="w-5 h-5 text-purple-500" /> Cron-Übersicht
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchCrons} disabled={cronsLoading}>
            <RefreshCw className={cronsLoading ? 'animate-spin' : ''} />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-xs">
          {cronsLoading && <div className="text-gray-400">Lade Cron-Status...</div>}
          {!cronsLoading && crons.length === 0 && <div className="text-gray-400">Keine geplanten Aufgaben gefunden.</div>}
          {!cronsLoading && crons.length > 0 && (
            <table className="min-w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left font-semibold text-purple-600 dark:text-purple-300">Aufgabe</th>
                  <th className="px-2 py-1 text-left font-semibold text-purple-600 dark:text-purple-300">Zeitplan</th>
                  <th className="px-2 py-1 text-left font-semibold text-purple-600 dark:text-purple-300">Letzter Lauf</th>
                  <th className="px-2 py-1 text-left font-semibold text-purple-600 dark:text-purple-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {crons.map((cron, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1">{cron.name}</td>
                    <td className="px-2 py-1">{cron.schedule}</td>
                    <td className="px-2 py-1">{new Date(cron.lastRun).toLocaleString('de-DE')}</td>
                    <td className={cron.status === 'OK' ? 'text-green-600' : 'text-red-600'}>{cron.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Konfiguration */}
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 border-0 shadow-md col-span-1 sm:col-span-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-orange-700 dark:text-orange-300">
            <Settings className="w-5 h-5 text-orange-500" /> Konfiguration
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchConfig} disabled={configLoading}>
            <RefreshCw className={configLoading ? 'animate-spin' : ''} />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-xs">
          {configLoading && <div className="text-gray-400">Lade Konfiguration...</div>}
          {config && !configLoading && (
            <>
              <div className="flex gap-2 items-center">
                <label className="w-32">Warnschwelle (dB):</label>
                <input type="number" className="border rounded px-2 py-1 w-20" value={config.warningThreshold} onChange={e => handleConfigChange('warningThreshold', Number(e.target.value))} />
              </div>
              <div className="flex gap-2 items-center">
                <label className="w-32">Alarm-Schwelle (dB):</label>
                <input type="number" className="border rounded px-2 py-1 w-20" value={config.alarmThreshold} onChange={e => handleConfigChange('alarmThreshold', Number(e.target.value))} />
              </div>
              <div className="flex gap-2 items-center">
                <label className="w-32">Berechnungsgrundlage:</label>
                <select className="border rounded px-2 py-1 w-32" value={config.calculationMode} onChange={e => handleConfigChange('calculationMode', e.target.value)}>
                  <option value="max">Maximum</option>
                  <option value="average">Mittelwert</option>
                  <option value="median">Median</option>
                </select>
              </div>
              <div className="text-xs text-gray-500 mb-2 ml-1">
                Die Berechnungsgrundlage bestimmt, wie der dB-Wert aus den Einzelmessungen eines Zeitblocks berechnet wird:<br/>
                <b>Maximum</b>: Höchster Wert im Block.<br/>
                <b>Mittelwert</b>: Durchschnitt aller Werte.<br/>
                <b>Median</b>: Der mittlere Wert (robust gegen Ausreißer).<br/>
                Die Schwellenwerte (Warnung, Alarm, LAS, LAF) werden auf diesen berechneten Wert angewendet.
              </div>
              <div className="flex gap-2 items-center">
                <label className="w-32">LAS-Schwelle (dB):</label>
                <input type="number" className="border rounded px-2 py-1 w-20" value={config.lasThreshold} onChange={e => handleConfigChange('lasThreshold', Number(e.target.value))} />
              </div>
              <div className="flex gap-2 items-center">
                <label className="w-32">LAF-Schwelle (dB):</label>
                <input type="number" className="border rounded px-2 py-1 w-20" value={config.lafThreshold} onChange={e => handleConfigChange('lafThreshold', Number(e.target.value))} />
              </div>
              <div className="flex gap-2 items-center">
                <label className="w-32">Stationen:</label>
                <input type="text" className="border rounded px-2 py-1 w-64" value={config.stations?.join(', ') || ''} onChange={e => handleConfigChange('stations', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} />
              </div>
              <div className="flex gap-2 items-center">
                <label className="w-32">Benachrichtigungen:</label>
                <input type="checkbox" checked={!!config.enableNotifications} onChange={e => handleConfigChange('enableNotifications', e.target.checked)} />
              </div>
              <div className="flex gap-2 items-center">
                <label className="w-32">CSV Auto-Verarbeitung:</label>
                <input type="checkbox" checked={!!config.csvAutoProcess} onChange={e => handleConfigChange('csvAutoProcess', e.target.checked)} />
              </div>
              <div className="flex gap-2 items-center">
                <label className="w-32">Backup-Aufbewahrung (Tage):</label>
                <input type="number" className="border rounded px-2 py-1 w-20" value={config.backupRetentionDays} onChange={e => handleConfigChange('backupRetentionDays', Number(e.target.value))} />
              </div>
              <div className="flex gap-2 items-center">
                <label className="w-32">UI-Theme:</label>
                <select className="border rounded px-2 py-1 w-32" value={config.uiTheme} onChange={e => handleConfigChange('uiTheme', e.target.value)}>
                  <option value="system">System</option>
                  <option value="light">Hell</option>
                  <option value="dark">Dunkel</option>
                </select>
              </div>
              <Button onClick={handleConfigSave} disabled={configSaving} className="mt-2 w-40 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold">
                {configSaving ? 'Speichern...' : 'Speichern'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Hilfetext */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
        <p>Alle Aktionen wirken sich sofort auf das System aus. CSV-Uploads werden automatisch verarbeitet. Wetterdaten werden alle 10 Minuten aktualisiert.</p>
        <p className="mt-1">Für Support oder Fragen: <a href="mailto:support@wood-one.live" className="underline">support@wood-one.live</a></p>
      </div>
    </div>
  )
} 