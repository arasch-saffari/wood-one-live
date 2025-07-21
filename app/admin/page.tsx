"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Database, FileText, Activity, Eye, Upload } from "lucide-react"
import { motion } from "framer-motion"
import { runTerminalCommand } from '@/lib/utils' // Hilfsfunktion für serverseitige Shell-Kommandos (ggf. anlegen)
import { Badge } from "@/components/ui/badge"

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
      alert(data.message || 'Neuaufbau abgeschlossen.')
      window.location.reload()
    } catch (e) {
      alert('Fehler beim Neuaufbau: ' + (e?.message || e))
    } finally {
      setResetting(false)
    }
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
                <span className="text-xs text-gray-500">{dir.fileCount} Dateien</span>
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
      </div>

      {/* Hilfetext */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
        <p>Alle Aktionen wirken sich sofort auf das System aus. CSV-Uploads werden automatisch verarbeitet. Wetterdaten werden alle 10 Minuten aktualisiert.</p>
        <p className="mt-1">Für Support oder Fragen: <a href="mailto:support@wood-one.live" className="underline">support@wood-one.live</a></p>
      </div>
    </div>
  )
} 