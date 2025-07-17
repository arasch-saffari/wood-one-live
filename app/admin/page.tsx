"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Database, FileText, Activity, Eye } from "lucide-react"
import { motion } from "framer-motion"

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

  return (
    <div className="space-y-6">
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

      {/* CSV Watcher Status */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="w-5 h-5 text-green-400" />
              <span>CSV-Watcher Status</span>
            </CardTitle>
            <CardDescription>
              Automatische Überwachung und Verarbeitung neuer CSV-Dateien
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingStatus ? (
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Lade Status...</span>
              </div>
            ) : watcherStatus ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${watcherStatus.watcherActive ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-medium">
                      {watcherStatus.watcherActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  <Button
                    onClick={fetchWatcherStatus}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Aktualisieren
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {watcherStatus.totalFiles}
                    </div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      CSV-Dateien
                    </div>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {watcherStatus.watchedDirectories.length}
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400">
                      Überwachte Ordner
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">Überwachte Ordner:</h4>
                  {watcherStatus.watchedDirectories.map((dir) => (
                    <div key={dir.station} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900 dark:text-white capitalize">
                          {dir.station}
                        </span>
                        <span className="text-sm text-gray-500">
                          {dir.fileCount} Dateien
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        {dir.path}
                      </div>
                      {dir.files.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            Neueste Dateien:
                          </div>
                          {dir.files.slice(0, 3).map((file) => (
                            <div key={file.name} className="text-xs text-gray-600 dark:text-gray-400 flex justify-between">
                              <span>{file.name}</span>
                              <span>{formatFileSize(file.size)} • {formatDate(file.modified)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-red-500">Fehler beim Laden des Status</div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* CSV Processing Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-purple-400" />
              <span>Manuelle CSV-Verarbeitung</span>
            </CardTitle>
            <CardDescription>
              Alle CSV-Dateien manuell in die Datenbank importieren
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <div className={`p-4 rounded-lg ${
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
                <p className={`text-sm mt-1 ${
                  lastResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {lastResult.message || lastResult.error}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Instructions Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-orange-400" />
              <span>Automatische Verarbeitung</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-white">CSV-Watcher Features:</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Automatische Erkennung neuer CSV-Dateien</li>
                <li>• Überwachung alle 10 Sekunden</li>
                <li>• Duplikat-Erkennung verhindert doppelte Verarbeitung</li>
                <li>• Sofortige Datenbank-Integration</li>
                <li>• Datei-Tracking für bessere Performance</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-white">Performance-Verbesserungen:</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Keine manuelle Verarbeitung mehr nötig</li>
                <li>• Datenbank-Indizes für schnelle Abfragen</li>
                <li>• Wetterdaten-Caching (5 Minuten)</li>
                <li>• Reduzierte Server-Last</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
} 