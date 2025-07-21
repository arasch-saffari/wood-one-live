"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Database, FileText, Activity, Eye, Upload, Download, UploadCloud, AlertTriangle, HardDrive, Cloud, Database as DbIcon, Pencil, Trash2, Terminal, BarChart3, Clock, Settings, Search, Sun, Moon, MapPin, Mail, KeyRound, Bell, Settings2, Palette, DatabaseZap, UploadCloud as UploadCloudIcon } from "lucide-react"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ToastAction } from '@/components/ui/toast'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Sidebar, SidebarMenu, SidebarMenuButton, SidebarProvider } from '@/components/ui/sidebar'
import Link from "next/link"

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

export default function AdminDashboard() {
  // Segment-Auswahl für die Sidebar
  const [segment, setSegment] = useState<'overview'|'thresholds'|'system'|'csv'|'backup'|'correction'|'settings'>('overview')
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [health, setHealth] = useState<any>(null)
  const [cron, setCron] = useState<any>(null)
  const [watcher, setWatcher] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [backupUploading, setBackupUploading] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState<string|null>(null)
  const [resetting, setResetting] = useState(false)
  const [csvStatus, setCsvStatus] = useState<any>(null)
  const [csvUploading, setCsvUploading] = useState<{[station: string]: boolean}>({})
  const [csvError, setCsvError] = useState<string|null>(null)
  const [correctionQuery, setCorrectionQuery] = useState('')
  const [correctionStation, setCorrectionStation] = useState('ort')
  const [correctionType, setCorrectionType] = useState<'measurement'|'weather'>('measurement')
  const [correctionData, setCorrectionData] = useState<any[]>([])
  const [correctionLoading, setCorrectionLoading] = useState(false)
  const [correctionError, setCorrectionError] = useState<string|null>(null)
  const [correctionStats, setCorrectionStats] = useState<any>(null)
  const [editRow, setEditRow] = useState<any|null>(null)
  const [editValue, setEditValue] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const { toast } = useToast()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [rowToDelete, setRowToDelete] = useState<any|null>(null)
  const [undoData, setUndoData] = useState<any|null>(null)
  const [undoTimeout, setUndoTimeout] = useState<any>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [rowToEdit, setRowToEdit] = useState<any|null>(null)
  const [configError, setConfigError] = useState<string|null>(null)
  const [editTimeSheet, setEditTimeSheet] = useState(false)
  const [editTimeStation, setEditTimeStation] = useState<string|null>(null)
  const [editTimeIdx, setEditTimeIdx] = useState<number|null>(null)
  const [editTimeFrom, setEditTimeFrom] = useState('08:00')
  const [editTimeTo, setEditTimeTo] = useState('20:00')

  useEffect(() => {
    if (segment === 'thresholds') {
      setLoading(true)
      fetch('/api/admin/config').then(res => res.json()).then(data => {
        setConfig(data)
        setLoading(false)
      })
    }
    if (segment === 'overview' || segment === 'system') {
      fetch('/api/admin/health').then(res => res.json()).then(setHealth)
      fetch('/api/admin/cron').then(res => res.json()).then(setCron)
      fetch('/api/csv-watcher-status').then(res => res.json()).then(setWatcher)
      fetch('/api/admin/logs').then(res => res.json()).then(data => setLogs(data.lines || []))
    }
    if (segment === 'csv') {
      fetch('/api/csv-watcher-status').then(res => res.json()).then(setCsvStatus)
    }
    if (segment === 'correction') {
      fetchCorrectionStats()
      fetchCorrectionData()
    }
  }, [segment])

  function handleThresholdChange(station: string, idx: number, key: string, value: number | string) {
    setConfig((prev: any) => {
      const updated = { ...prev }
      updated.thresholdsByStationAndTime = { ...updated.thresholdsByStationAndTime }
      updated.thresholdsByStationAndTime[station] = updated.thresholdsByStationAndTime[station].map((block: any, i: number) =>
        i === idx ? { ...block, [key]: value } : block
      )
      return updated
    })
  }

  async function handleSave() {
    setSaving(true)
    setConfigError(null)
    // E-Mail-Validierung
    if (config.adminEmail && !/^\S+@\S+\.\S+$/.test(config.adminEmail)) {
      setConfigError('Bitte eine gültige E-Mail-Adresse eingeben.')
      setSaving(false)
      return
    }
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      const data = await res.json()
      if (!data.success) {
        setConfigError(data.message || 'Fehler beim Speichern.')
        toast({ title: 'Fehler', description: data.message || 'Fehler beim Speichern.', variant: 'destructive' })
      } else {
        toast({ title: 'Gespeichert', description: 'Konfiguration erfolgreich gespeichert.' })
      }
    } catch (e: any) {
      setConfigError(e?.message || 'Fehler beim Speichern.')
      toast({ title: 'Fehler', description: e?.message || 'Fehler beim Speichern.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleBackupDownload() {
    window.open('/api/admin/backup-db', '_blank')
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBackupUploading(true)
    setRestoreMessage(null)
    // Simuliere Restore (hier müsste ein echter Restore-API-Endpoint implementiert werden)
    setTimeout(() => {
      setBackupUploading(false)
      setRestoreMessage('Restore erfolgreich (Demo, implementiere echten Restore-Endpoint)')
    }, 2000)
  }

  async function handleFactoryReset() {
    if (!window.confirm('Wirklich ALLE Daten (Messwerte, Wetter, CSVs) löschen und System zurücksetzen?')) return
    setResetting(true)
    const res = await fetch('/api/admin/factory-reset', { method: 'POST' })
    const data = await res.json()
    setResetting(false)
    setRestoreMessage(data.message || 'Zurücksetzen abgeschlossen.')
  }

  async function handleCsvUpload(station: string, file: File) {
    setCsvUploading(prev => ({ ...prev, [station]: true }))
    setCsvError(null)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('station', station)
    try {
      const res = await fetch('/api/admin/upload-csv', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || !data.success) setCsvError(data.message || 'Fehler beim Upload')
      fetch('/api/csv-watcher-status').then(res => res.json()).then(setCsvStatus)
    } catch (e: any) {
      setCsvError(e?.message || 'Fehler beim Upload')
    } finally {
      setCsvUploading(prev => ({ ...prev, [station]: false }))
    }
  }

  function handleDrop(station: string, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.name.endsWith('.csv')) {
        handleCsvUpload(station, file)
      } else {
        setCsvError('Nur CSV-Dateien erlaubt')
      }
    }
  }

  async function fetchCorrectionStats() {
    try {
      const res = await fetch(`/api/admin/correction-stats?station=${correctionStation}&type=${correctionType}`)
      setCorrectionStats(await res.json())
    } catch (e: any) {
      setCorrectionError(e?.message || 'Fehler beim Laden der Statistiken')
    }
  }
  async function fetchCorrectionData() {
    setCorrectionLoading(true)
    setCorrectionError(null)
    try {
      const res = await fetch(`/api/admin/correction-data?station=${correctionStation}&type=${correctionType}&q=${encodeURIComponent(correctionQuery)}`)
      setCorrectionData(await res.json())
    } catch (e: any) {
      setCorrectionError(e?.message || 'Fehler beim Laden der Daten')
    } finally {
      setCorrectionLoading(false)
    }
  }
  async function handleEditSave() {
    if (!editRow) return
    setEditSaving(true)
    try {
      const res = await fetch('/api/admin/correction-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editRow.id, value: editValue, type: correctionType })
      })
      const data = await res.json()
      if (!data.success) setCorrectionError(data.message || 'Fehler beim Speichern')
      setEditRow(null)
      fetchCorrectionData()
      fetchCorrectionStats()
    } catch (e: any) {
      setCorrectionError(e?.message || 'Fehler beim Speichern')
    } finally {
      setEditSaving(false)
    }
  }
  async function handleDelete(row: any) {
    setRowToDelete(row)
    setShowDeleteDialog(true)
  }
  async function confirmDelete() {
    setShowDeleteDialog(false)
    if (!rowToDelete) return
    const deletedRow = rowToDelete
    setRowToDelete(null)
    try {
      await fetch('/api/admin/correction-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletedRow.id, type: correctionType })
      })
      setUndoData(deletedRow)
      const timeout = setTimeout(() => setUndoData(null), 5000)
      setUndoTimeout(timeout)
      toast({
        title: 'Gelöscht',
        description: 'Datensatz wurde gelöscht.',
        action: <ToastAction altText="Rückgängig" onClick={undoDelete}>Rückgängig</ToastAction>,
        duration: 5000
      })
      fetchCorrectionData()
      fetchCorrectionStats()
    } catch (e: any) {
      setCorrectionError(e?.message || 'Fehler beim Löschen')
    }
  }
  async function undoDelete() {
    if (!undoData) return
    clearTimeout(undoTimeout)
    setUndoTimeout(null)
    try {
      await fetch('/api/admin/correction-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: undoData.id, value: undoData.value, type: correctionType })
      })
      setUndoData(null)
      toast({ title: 'Wiederhergestellt', description: 'Löschung rückgängig gemacht.' })
      fetchCorrectionData()
      fetchCorrectionStats()
    } catch (e: any) {
      setCorrectionError(e?.message || 'Fehler beim Wiederherstellen')
    }
  }
  function handleEdit(row: any) {
    setRowToEdit(row)
    setEditValue(row.value)
    setShowEditDialog(true)
  }
  async function confirmEdit() {
    setShowEditDialog(false)
    if (!rowToEdit) return
    if (!editValue || editValue === rowToEdit.value) {
      setCorrectionError('Wert darf nicht leer oder unverändert sein')
      return
    }
    setEditSaving(true)
    try {
      await fetch('/api/admin/correction-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rowToEdit.id, value: editValue, type: correctionType })
      })
      setRowToEdit(null)
      setEditRow(null)
      setEditValue('')
      toast({ title: 'Gespeichert', description: 'Wert wurde aktualisiert.' })
      fetchCorrectionData()
      fetchCorrectionStats()
    } catch (e: any) {
      setCorrectionError(e?.message || 'Fehler beim Speichern')
    } finally {
      setEditSaving(false)
    }
  }

  function handleEditTime(station: string, idx: number, from: string, to: string) {
    console.log('handleEditTime aufgerufen:', { station, idx, from, to })
    setEditTimeStation(station)
    setEditTimeIdx(idx)
    setEditTimeFrom(from)
    setEditTimeTo(to)
    setEditTimeSheet(true)
  }
  function handleEditTimeSave() {
    if (!editTimeStation || editTimeIdx === null) return
    setConfig((prev: any) => {
      const updated = { ...prev }
      updated.thresholdsByStationAndTime = { ...updated.thresholdsByStationAndTime }
      updated.thresholdsByStationAndTime[editTimeStation] = updated.thresholdsByStationAndTime[editTimeStation].map((block: any, i: number) =>
        i === editTimeIdx ? { ...block, from: editTimeFrom, to: editTimeTo } : block
      )
      return updated
    })
    setEditTimeSheet(false)
    setTimeout(() => { handleSave(); toast({ title: 'Gespeichert', description: 'Zeitblock erfolgreich geändert.' }) }, 100)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Sidebar (fixed, styled wie Dashboard) */}
      <SidebarProvider>
        <div>
          <div className="fixed inset-y-0 left-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl shadow-slate-900/10 dark:shadow-black/20 hidden lg:flex flex-col w-[280px]">
            {/* Logo und Titel */}
            <div className="flex h-24 items-center px-6">
              <div className="flex items-center space-x-3 whitespace-nowrap min-w-0 flex-nowrap">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent truncate block">
                  Wood-One Live
                </span>
                <span className="ml-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex-shrink-0">Admin</span>
              </div>
            </div>
            {/* Navigation */}
            <nav className="flex-1 px-6 py-10 space-y-4">
              <SidebarMenu>
                <SidebarMenuButton isActive={segment==='overview'} onClick={()=>setSegment('overview')}
                  className="transition-all duration-200 group flex items-center rounded-2xl text-sm font-medium relative px-5 py-4 text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-violet-500 data-[active=true]:to-purple-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-violet-500/25">
                  <Database className="w-4 h-4" /> Übersicht
                </SidebarMenuButton>
                <SidebarMenuButton isActive={segment==='thresholds'} onClick={()=>setSegment('thresholds')}
                  className="transition-all duration-200 group flex items-center rounded-2xl text-sm font-medium relative px-5 py-4 text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-violet-500 data-[active=true]:to-purple-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-violet-500/25">
                  <Settings2 className="w-4 h-4" /> Schwellenwerte
                </SidebarMenuButton>
                <SidebarMenuButton isActive={segment==='system'} onClick={()=>setSegment('system')}
                  className="transition-all duration-200 group flex items-center rounded-2xl text-sm font-medium relative px-5 py-4 text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-violet-500 data-[active=true]:to-purple-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-violet-500/25">
                  <Activity className="w-4 h-4" /> System & Health
                </SidebarMenuButton>
                <SidebarMenuButton isActive={segment==='csv'} onClick={()=>setSegment('csv')}
                  className="transition-all duration-200 group flex items-center rounded-2xl text-sm font-medium relative px-5 py-4 text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-violet-500 data-[active=true]:to-purple-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-violet-500/25">
                  <FileText className="w-4 h-4" /> CSV & Import
                </SidebarMenuButton>
                <SidebarMenuButton isActive={segment==='backup'} onClick={()=>setSegment('backup')}
                  className="transition-all duration-200 group flex items-center rounded-2xl text-sm font-medium relative px-5 py-4 text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-violet-500 data-[active=true]:to-purple-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-violet-500/25">
                  <HardDrive className="w-4 h-4" /> Backup & Restore
                </SidebarMenuButton>
                <SidebarMenuButton isActive={segment==='correction'} onClick={()=>setSegment('correction')}
                  className="transition-all duration-200 group flex items-center rounded-2xl text-sm font-medium relative px-5 py-4 text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-violet-500 data-[active=true]:to-purple-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-violet-500/25">
                  <BarChart3 className="w-4 h-4" /> Datenkorrektur
                </SidebarMenuButton>
                <SidebarMenuButton isActive={segment==='settings'} onClick={()=>setSegment('settings')}
                  className="transition-all duration-200 group flex items-center rounded-2xl text-sm font-medium relative px-5 py-4 text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-violet-500 data-[active=true]:to-purple-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-violet-500/25">
                  <Settings className="w-4 h-4" /> Einstellungen
                </SidebarMenuButton>
              </SidebarMenu>
            </nav>
          </div>
          {/* Main Content mit Margin */}
          <div className="lg:ml-[280px]">
            {/* Kein Header mehr über dem Content */}
            <main className="flex-1 p-6 md:p-10 w-full max-w-7xl mx-auto min-h-screen">
              {segment === 'overview' && (
                <section className="space-y-8">
                  <h1 className="text-2xl font-bold mb-6">Admin Übersicht</h1>
                  <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    <Card className="max-w-2xl w-full p-6 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                      <CardHeader><CardTitle>Datenbank</CardTitle></CardHeader>
                      <CardContent>
                        <div className="text-sm">Größe: <b>{health?.dbSize ? (health.dbSize/1024/1024).toFixed(2) : '-'} MB</b></div>
                        <div className="text-sm">Letztes Backup: <b>-</b></div>
                      </CardContent>
                    </Card>
                    <Card className="max-w-2xl w-full p-6 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                      <CardHeader><CardTitle>CSV-Watcher</CardTitle></CardHeader>
                      <CardContent>
                        <div className="text-sm">Status: <Badge className={watcher?.watcherActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{watcher?.watcherActive ? 'Aktiv' : 'Inaktiv'}</Badge></div>
                        <div className="text-sm">Letzter Heartbeat: <b>{watcher?.watcherHeartbeat ? new Date(watcher.watcherHeartbeat).toLocaleString() : '-'}</b></div>
                        <div className="text-sm">CSV-Dateien: <b>{watcher?.totalFiles ?? '-'}</b></div>
                      </CardContent>
                    </Card>
                    <Card className="max-w-2xl w-full p-6 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                      <CardHeader><CardTitle>System</CardTitle></CardHeader>
                      <CardContent>
                        <div className="text-sm">Zeit: <b>{health?.time ? new Date(health.time).toLocaleString() : '-'}</b></div>
                        <div className="text-sm">Speicher frei: <b>{health?.diskFree ? (health.diskFree/1024/1024/1024).toFixed(2) : '-'} GB</b></div>
                        <div className="text-sm">Speicher gesamt: <b>{health?.diskTotal ? (health?.diskTotal/1024/1024/1024).toFixed(2) : '-'} GB</b></div>
                      </CardContent>
                    </Card>
                  </div>
                  <Card className="max-w-6xl mx-auto w-full mb-8 p-6 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Geplante Aufgaben (Cron)</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Aufgabe</TableHead><TableHead>Intervall</TableHead><TableHead>Letzter Lauf</TableHead><TableHead>Status</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {cron?.crons?.map((c: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell>{c.name}</TableCell>
                              <TableCell>{c.schedule}</TableCell>
                              <TableCell>{c.lastRun ? new Date(c.lastRun).toLocaleString() : '-'}</TableCell>
                              <TableCell><Badge className={c.status === 'OK' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{c.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  <Card className="max-w-6xl mx-auto w-full mb-8 p-6 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Letzte System-Logs</CardTitle></CardHeader>
                    <CardContent>
                      <div className="max-h-64 overflow-y-auto font-mono text-xs bg-gray-50 dark:bg-gray-900/40 rounded p-2 border border-gray-200 dark:border-gray-700">
                        {logs.length === 0 ? <div className="text-gray-400">Keine Logs gefunden.</div> : logs.map((line, i) => <div key={i}>{line}</div>)}
                      </div>
                    </CardContent>
                  </Card>
                </section>
              )}
              {segment === 'thresholds' && (
                <section className="space-y-8">
                  <h1 className="text-2xl font-bold mb-6">Schwellenwerte</h1>
                  {config && config.thresholdsByStationAndTime && (
                    <div className="flex flex-col gap-8">
                      {Object.entries(config.thresholdsByStationAndTime).map(([station, blocks]) => (
                        <Card key={station} className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                          <CardHeader className="flex flex-row items-center gap-4 pb-2">
                            <div className="flex items-center gap-3">
                              {station === 'ort' && <MapPin className="w-7 h-7 text-emerald-500" />}
                              {station === 'techno' && <Settings2 className="w-7 h-7 text-fuchsia-500" />}
                              {station === 'heuballern' && <Sun className="w-7 h-7 text-blue-500" />}
                              {station === 'band' && <DatabaseZap className="w-7 h-7 text-orange-500" />}
                              <CardTitle className="capitalize text-2xl tracking-tight text-card-foreground">{station}</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-col gap-8">
                              {(blocks as any[]).map((block, idx) => {
                                const isDay = block.from < block.to
                                return (
                                  <div key={idx} className="flex flex-col gap-4 p-6 rounded-xl border border-border bg-muted/60 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      {isDay ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-blue-400" />}
                                      <span className="font-semibold text-base text-card-foreground">{block.from} - {block.to}</span>
                                      <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${isDay ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{isDay ? 'Tag' : 'Nacht'}</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div className="flex flex-col gap-1">
                                        <Label className="text-xs">Warnung</Label>
                                        <Input type="number" value={block.warning} onChange={e => handleThresholdChange(station, idx, 'warning', Number(e.target.value))} className="focus:ring-2 focus:ring-primary border-border" />
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        <Label className="text-xs">Alarm</Label>
                                        <Input type="number" value={block.alarm} onChange={e => handleThresholdChange(station, idx, 'alarm', Number(e.target.value))} className="focus:ring-2 focus:ring-primary border-border" />
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        <Label className="text-xs">LAS</Label>
                                        <Input type="number" value={block.las} onChange={e => handleThresholdChange(station, idx, 'las', Number(e.target.value))} className="focus:ring-2 focus:ring-primary border-border" />
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        <Label className="text-xs">LAF</Label>
                                        <Input type="number" value={block.laf} onChange={e => handleThresholdChange(station, idx, 'laf', Number(e.target.value))} className="focus:ring-2 focus:ring-primary border-border" />
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        <Label className="text-xs">Von</Label>
                                        <Input type="time" value={block.from} onChange={e => handleThresholdChange(station, idx, 'from', e.target.value)} className="focus:ring-2 focus:ring-primary border-border" />
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        <Label className="text-xs">Bis</Label>
                                        <Input type="time" value={block.to} onChange={e => handleThresholdChange(station, idx, 'to', e.target.value)} className="focus:ring-2 focus:ring-primary border-border" />
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </CardContent>
                          <CardFooter className="pt-6 flex justify-end">
                            <Button className="px-6 py-2 text-base font-semibold shadow" onClick={handleSave} disabled={saving}>{saving ? 'Speichern...' : 'Speichern'}</Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              )}
              {segment === 'system' && (
                <section className="space-y-8">
                  <h1 className="text-2xl font-bold mb-6">System & Health</h1>
                  {!health && <div className="text-sm text-gray-500">Lade Systemdaten...</div>}
                  {health?.error && <div className="text-sm text-red-500">{health.error}</div>}
                  {health && !health.error && (
                    <>
                      <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                        <CardHeader><CardTitle>Datenbank</CardTitle></CardHeader>
                        <CardContent>
                          <div className="text-sm">Größe: <b>{health.dbSize ? (health.dbSize/1024/1024).toFixed(2) : '-'} MB</b></div>
                          <div className="text-sm">Letztes Backup: <b>{health.lastBackup ? new Date(health.lastBackup).toLocaleString() : '-'}</b></div>
                        </CardContent>
                      </Card>
                      <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                        <CardHeader><CardTitle>CSV-Watcher</CardTitle></CardHeader>
                        <CardContent>
                          <div className="text-sm">Status: <Badge className={health.watcherActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{health.watcherActive ? 'Aktiv' : 'Inaktiv'}</Badge></div>
                          <div className="text-sm">Letzter Heartbeat: <b>{health.watcherHeartbeat ? new Date(health.watcherHeartbeat).toLocaleString() : '-'}</b></div>
                        </CardContent>
                      </Card>
                      <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                        <CardHeader><CardTitle>System</CardTitle></CardHeader>
                        <CardContent>
                          <div className="text-sm">Zeit: <b>{health.time ? new Date(health.time).toLocaleString() : '-'}</b></div>
                          <div className="text-sm">Speicher frei: <b>{health.diskFree ? (health.diskFree/1024/1024/1024).toFixed(2) : '-'} GB</b></div>
                          <div className="text-sm">Speicher gesamt: <b>{health.diskTotal ? (health.diskTotal/1024/1024/1024).toFixed(2) : '-'} GB</b></div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </section>
              )}
              {segment === 'csv' && (
                <section className="space-y-8">
                  <h1 className="text-2xl font-bold mb-6">CSV & Import</h1>
                  <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>CSV-Dateien & Upload</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      {csvError && <div className="text-xs text-red-500">{csvError}</div>}
                      <div className="grid grid-cols-1 gap-4">
                        {csvStatus?.watchedDirectories?.map((dir: any) => (
                          <div key={dir.station} className="border rounded-xl p-4 bg-white/80 dark:bg-slate-800/60">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold capitalize">{dir.station}</span>
                              <Badge className="bg-gray-100 text-gray-700 border-gray-300 ml-2">{dir.fileCount} Dateien</Badge>
                            </div>
                            <div
                              className="border-2 border-dashed border-orange-300 rounded-lg p-3 mb-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-800/40"
                              onDrop={e => handleDrop(dir.station, e)}
                              onDragOver={e => e.preventDefault()}
                            >
                              <UploadCloud className="inline w-4 h-4 mr-1" />
                              Datei hierher ziehen oder klicken
                              <input type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleCsvUpload(dir.station, e.target.files[0]) }} disabled={csvUploading[dir.station]} />
                            </div>
                            <div className="max-h-32 overflow-y-auto text-xs">
                              {dir.files.length === 0 ? <div className="text-gray-400">Keine Dateien</div> : dir.files.map((file: any) => (
                                <div key={file.name} className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 py-1">
                                  <span>{file.name}</span>
                                  <span className="text-gray-400 ml-2">{new Date(file.modified).toLocaleString()}</span>
                                  <a href={`/csv/${dir.station}/${file.name}`} target="_blank" rel="noopener" className="ml-2 text-blue-500 hover:underline"><Eye className="w-3 h-3 inline" /></a>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Watcher-Status</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-sm">Status: <Badge className={csvStatus?.watcherActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{csvStatus?.watcherActive ? 'Aktiv' : 'Inaktiv'}</Badge></div>
                      <div className="text-sm">Letzter Heartbeat: <b>{csvStatus?.watcherHeartbeat ? new Date(csvStatus.watcherHeartbeat).toLocaleString() : '-'}</b></div>
                      <div className="text-sm">CSV-Dateien: <b>{csvStatus?.totalFiles ?? '-'}</b></div>
                    </CardContent>
                  </Card>
                  <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Factory Reset</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <Button onClick={handleFactoryReset} className="w-48 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold" size="lg" disabled={resetting}>
                        <Trash2 className="w-4 h-4 mr-2" /> {resetting ? 'Zurücksetzen...' : 'System zurücksetzen'}
                      </Button>
                      <div className="text-xs text-gray-500">Löscht alle Messwerte, Wetterdaten und CSV-Dateien unwiderruflich.</div>
                    </CardContent>
                  </Card>
                  <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Backup-Plan</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-sm">Tägliches automatisches Backup um 03:00 Uhr (siehe <code>backups/</code> Verzeichnis).</div>
                    </CardContent>
                  </Card>
                </section>
              )}
              {segment === 'backup' && (
                <section className="space-y-8">
                  <h1 className="text-2xl font-bold mb-6">Backup & Restore</h1>
                  <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Datenbank-Backup</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <Button onClick={handleBackupDownload} className="w-48 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold" size="lg">
                        <Download className="w-4 h-4 mr-2" /> Backup herunterladen
                      </Button>
                      <div className="text-xs text-gray-500">Das Backup enthält alle Messwerte, Wetterdaten und Konfigurationen.</div>
                    </CardContent>
                  </Card>
                  <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Restore (Wiederherstellen)</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <UploadCloud className="w-5 h-5 text-orange-500" />
                        <input type="file" accept=".sqlite" onChange={handleRestore} className="hidden" disabled={backupUploading} />
                        <span className="text-sm">Backup-Datei auswählen (.sqlite)</span>
                      </label>
                      {backupUploading && <div className="text-xs text-orange-500">Restore läuft...</div>}
                      {restoreMessage && <div className="text-xs text-emerald-600">{restoreMessage}</div>}
                    </CardContent>
                  </Card>
                  <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Factory Reset</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <Button onClick={handleFactoryReset} className="w-48 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold" size="lg" disabled={resetting}>
                        <Trash2 className="w-4 h-4 mr-2" /> {resetting ? 'Zurücksetzen...' : 'System zurücksetzen'}
                      </Button>
                      <div className="text-xs text-gray-500">Löscht alle Messwerte, Wetterdaten und CSV-Dateien unwiderruflich.</div>
                    </CardContent>
                  </Card>
                  <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Backup-Plan</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-sm">Tägliches automatisches Backup um 03:00 Uhr (siehe <code>backups/</code> Verzeichnis).</div>
                    </CardContent>
                  </Card>
                </section>
              )}
              {segment === 'correction' && (
                <section className="space-y-8">
                  <h1 className="text-2xl font-bold mb-6">Datenkorrektur</h1>
                  <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Suche & Filter</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-4 items-end">
                      <div>
                        <Label>Station</Label>
                        <Select value={correctionStation} onValueChange={setCorrectionStation}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ort">Ort</SelectItem>
                            <SelectItem value="techno">Techno</SelectItem>
                            <SelectItem value="heuballern">Heuballern</SelectItem>
                            <SelectItem value="band">Band</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Typ</Label>
                        <Select value={correctionType} onValueChange={v => setCorrectionType(v as any)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="measurement">Messwert</SelectItem>
                            <SelectItem value="weather">Wetter</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <Label>Suche</Label>
                        <Input value={correctionQuery} onChange={e => setCorrectionQuery(e.target.value)} placeholder="Zeit, Wert, ID..." />
                      </div>
                      <Button variant="outline" onClick={fetchCorrectionData}><Search className="w-4 h-4 mr-1" />Suchen</Button>
                    </CardContent>
                  </Card>
                  <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Statistiken</CardTitle></CardHeader>
                    <CardContent>
                      {correctionStats ? (
                        <div className="flex gap-8 text-sm">
                          <div>Anzahl: <b>{correctionStats.count}</b></div>
                          <div>Letzte Änderung: <b>{correctionStats.lastModified ? new Date(correctionStats.lastModified).toLocaleString() : '-'}</b></div>
                        </div>
                      ) : <div className="text-gray-400">Keine Daten</div>}
                    </CardContent>
                  </Card>
                  <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Daten</CardTitle></CardHeader>
                    <CardContent>
                      {correctionError && <div className="text-xs text-red-500 mb-2">{correctionError}</div>}
                      {correctionLoading ? <div>Lade Daten...</div> : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Zeit</TableHead>
                              <TableHead>Wert</TableHead>
                              <TableHead>Aktionen</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {correctionData.length === 0 ? (
                              <TableRow><TableCell colSpan={4} className="text-gray-400">Keine Daten</TableCell></TableRow>
                            ) : correctionData.map(row => (
                              <TableRow key={row.id}>
                                <TableCell>{row.id}</TableCell>
                                <TableCell>{row.datetime ? new Date(row.datetime).toLocaleString() : row.time}</TableCell>
                                <TableCell>
                                  {editRow?.id === row.id ? (
                                    <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="w-24" />
                                  ) : (
                                    row.value
                                  )}
                                </TableCell>
                                <TableCell>
                                  {editRow?.id === row.id ? (
                                    <Button size="sm" onClick={handleEditSave} disabled={editSaving}>Speichern</Button>
                                  ) : (
                                    <>
                                      <Button size="sm" variant="outline" onClick={() => handleEdit(row)}><Pencil className="w-3 h-3" /></Button>
                                      <Button size="sm" variant="destructive" onClick={() => handleDelete(row)} className="ml-2"><Trash2 className="w-3 h-3" /></Button>
                                    </>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                  <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Löschen bestätigen</DialogTitle>
                      </DialogHeader>
                      <div>Möchtest du diesen Datensatz wirklich löschen?</div>
                      <DialogFooter>
                        <Button variant="outline" onClick={()=>setShowDeleteDialog(false)}>Abbrechen</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Löschen</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Wert bearbeiten</DialogTitle>
                      </DialogHeader>
                      <Input value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus />
                      <DialogFooter>
                        <Button variant="outline" onClick={()=>setShowEditDialog(false)}>Abbrechen</Button>
                        <Button onClick={confirmEdit} disabled={!editValue || editValue === rowToEdit?.value || editSaving}>Speichern</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  {/* Zeitblock-Edit-Sheet (shadcn) */}
                  <Sheet open={editTimeSheet} onOpenChange={setEditTimeSheet}>
                    <SheetContent side="right" className="w-[350px]">
                      <SheetHeader>
                        <SheetTitle>Zeitblock ändern</SheetTitle>
                      </SheetHeader>
                      <div className="flex flex-col gap-4 mt-4">
                        <div>
                          <Label>Von</Label>
                          <Input type="time" value={editTimeFrom} onChange={e => setEditTimeFrom(e.target.value)} />
                        </div>
                        <div>
                          <Label>Bis</Label>
                          <Input type="time" value={editTimeTo} onChange={e => setEditTimeTo(e.target.value)} />
                        </div>
                        <div className="text-xs text-gray-500 mt-2">DEBUG: from={editTimeFrom}, to={editTimeTo}</div>
                      </div>
                      <SheetFooter className="mt-8">
                        <Button variant="outline" onClick={()=>setEditTimeSheet(false)}>Abbrechen</Button>
                        <Button onClick={()=>setEditTimeSheet(false)} disabled={!editTimeFrom || !editTimeTo}>Speichern</Button>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>
                </section>
              )}
              {segment === 'settings' && <AdminSettings />}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  )
}

function AdminSettings() {
  // Settings für weitere Konfigurationen (ohne Schwellenwerte)
  const [config, setConfig] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/admin/config').then(res => res.json()).then(setConfig)
  }, [])

  // Handler für spätere Settings-Änderungen (z.B. Chart-Limits, Granularitäten)
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setConfig((prev: any) => ({ ...prev, [name]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          // Hier später weitere Settings explizit updaten
        })
      })
      if (!res.ok) throw new Error('Fehler beim Speichern')
      setSuccess(true)
    } catch (e: any) {
      setError(e.message || 'Unbekannter Fehler')
    } finally {
      setSaving(false)
    }
  }

  // Optionen für Intervalle und Granularitäten
  const intervalOptions = [
    { value: '24h', label: '24 Stunden' },
    { value: '7d', label: '7 Tage' },
  ]
  const granularityOptions = [
    { value: '1h', label: '1 Stunde' },
    { value: '15min', label: '15 Minuten' },
    { value: '10min', label: '10 Minuten' },
    { value: '5min', label: '5 Minuten' },
    { value: '1min', label: '1 Minute' },
  ]

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-bold mb-6">Globale Einstellungen</h1>
      <form onSubmit={handleSave} className="flex flex-col gap-8">
        <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Chart-Konfiguration</CardTitle>
            <CardDescription>Steuere Anzeige- und Standardwerte für alle Diagramme.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-2">
            <div>
              <Label htmlFor="chartLimit">Maximale Datenpunkte pro Chart</Label>
              <Input id="chartLimit" type="number" name="chartLimit" value={config?.chartLimit ?? 50} onChange={handleChange} min={10} max={500} step={1} />
            </div>
            <div>
              <Label htmlFor="defaultInterval">Standard-Intervall</Label>
              <Select name="defaultInterval" value={config?.defaultInterval ?? '24h'} onValueChange={val => handleChange({ target: { name: 'defaultInterval', value: val } } as any)}>
                <SelectTrigger id="defaultInterval">
                  <SelectValue placeholder="Intervall wählen" />
                </SelectTrigger>
                <SelectContent>
                  {intervalOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="defaultGranularity">Standard-Granularität</Label>
              <Select name="defaultGranularity" value={config?.defaultGranularity ?? '15min'} onValueChange={val => handleChange({ target: { name: 'defaultGranularity', value: val } } as any)}>
                <SelectTrigger id="defaultGranularity">
                  <SelectValue placeholder="Granularität wählen" />
                </SelectTrigger>
                <SelectContent>
                  {granularityOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card className="max-w-7xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">API & Wetter-Konfiguration</CardTitle>
            <CardDescription>Globale Limits und Fallbacks für API und Wetterdaten.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-2">
            <div>
              <Label htmlFor="apiMaxRequests">API Rate-Limit: Max. Requests</Label>
              <Input id="apiMaxRequests" type="number" name="apiMaxRequests" value={config?.apiMaxRequests ?? 30} onChange={handleChange} min={1} max={1000} step={1} />
            </div>
            <div>
              <Label htmlFor="apiIntervalMs">API Rate-Limit: Intervall (ms)</Label>
              <Input id="apiIntervalMs" type="number" name="apiIntervalMs" value={config?.apiIntervalMs ?? 60000} onChange={handleChange} min={1000} max={3600000} step={1000} />
            </div>
            <div className="pt-2 border-t mt-2">
              <div className="font-semibold mb-2">Wetterdaten-Fallbacks</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="weatherFallbackWindSpeed">Windgeschwindigkeit (km/h)</Label>
                  <Input id="weatherFallbackWindSpeed" type="number" name="weatherFallbackWindSpeed" value={config?.weatherFallbackWindSpeed ?? 0} onChange={handleChange} min={0} max={200} step={0.1} />
                </div>
                <div>
                  <Label htmlFor="weatherFallbackWindDir">Windrichtung (°/Text)</Label>
                  <Input id="weatherFallbackWindDir" type="text" name="weatherFallbackWindDir" value={config?.weatherFallbackWindDir ?? 'N'} onChange={handleChange} />
                </div>
                <div>
                  <Label htmlFor="weatherFallbackRelHumidity">rel. Luftfeuchtigkeit (%)</Label>
                  <Input id="weatherFallbackRelHumidity" type="number" name="weatherFallbackRelHumidity" value={config?.weatherFallbackRelHumidity ?? 50} onChange={handleChange} min={0} max={100} step={1} />
                </div>
                <div>
                  <Label htmlFor="weatherFallbackTemperature">Temperatur (°C)</Label>
                  <Input id="weatherFallbackTemperature" type="number" name="weatherFallbackTemperature" value={config?.weatherFallbackTemperature ?? 15} onChange={handleChange} min={-50} max={60} step={0.1} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end max-w-6xl mx-auto w-full">
          <Button type="submit" className="mt-4 px-8" disabled={saving}>{saving ? 'Speichern...' : 'Speichern'}</Button>
        </div>
        {error && <div className="text-red-500 mt-2 max-w-6xl mx-auto w-full">{error}</div>}
        {success && <div className="text-green-600 mt-2 max-w-6xl mx-auto w-full">Gespeichert!</div>}
      </form>
    </section>
  )
} 