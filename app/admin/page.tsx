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
import { SettingsForm, SettingsField } from "@/components/SettingsForm"
import { useCsvWatcherStatus } from "@/hooks/useCsvWatcherStatus"
import { useHealth } from "@/hooks/useHealth"
import { useCron } from "@/hooks/useCron"
import { useLogs } from "@/hooks/useLogs"
import { ErrorMessage } from "@/components/ErrorMessage"
import { LoadingSpinner } from "@/components/LoadingSpinner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { borderRadius, colors } from '@/lib/theme'

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
  const { health, loading: healthLoading, error: healthError } = useHealth()
  const { cron, loading: cronLoading, error: cronError } = useCron()
  const { logs, loading: logsLoading, error: logsError } = useLogs()
  const { watcherStatus: watcher, loading: watcherLoading, error: watcherError } = useCsvWatcherStatus()
  const { watcherStatus: csvStatus, loading: csvStatusLoading, error: csvStatusError } = useCsvWatcherStatus()
  const [backupUploading, setBackupUploading] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState<string|null>(null)
  const [resetting, setResetting] = useState(false)
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
  // Verschiebe die States und Hilfsfunktionen aus AdminSettings in den Hauptbereich:
  const [settingsConfig, setSettingsConfig] = useState<any>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string|null>(null)
  const [settingsSuccess, setSettingsSuccess] = useState(false)

  useEffect(() => {
    if (segment === 'thresholds') {
      setLoading(true)
      fetch('/api/admin/config').then(res => res.json()).then(data => {
        setConfig(data)
        setLoading(false)
      })
    }
    if (segment === 'overview' || segment === 'system') {
      if (health && (health.notify || health.integrityProblem)) {
        toast({
          title: 'Integritätsproblem',
          description: `Es wurden ${health.integrityCount || 'einige'} fehlerhafte Messungen (NULL in NOT NULL-Spalten) gefunden! Bitte prüfe die Datenbank.`,
          variant: 'destructive',
        })
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Integritätsproblem', {
            body: `Es wurden ${health.integrityCount || 'einige'} fehlerhafte Messungen gefunden!`,
            icon: '/alert-icon.png',
          })
        }
      }
    }
    if (segment === 'correction') {
      fetchCorrectionStats()
      fetchCorrectionData()
    }
    if (segment === 'settings') {
      fetch('/api/admin/config').then(res => res.json()).then(setSettingsConfig)
    }
  }, [segment, health])

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
    if (config.adminEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.adminEmail)) {
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
        toast({
          title: 'Fehler beim Speichern',
          description: data.message || 'Beim Speichern der Konfiguration ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
        if (data.notify && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Fehler beim Speichern', {
            body: data.message || 'Beim Speichern der Konfiguration ist ein Fehler aufgetreten.',
            icon: '/alert-icon.png',
          })
        }
      }
    } catch (e: any) {
      setConfigError(e?.message || 'Fehler beim Speichern.')
      toast({
        title: 'Fehler beim Speichern',
        description: e?.message || 'Beim Speichern der Konfiguration ist ein Fehler aufgetreten.',
        variant: 'destructive',
      })
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Fehler beim Speichern', {
          body: e?.message || 'Beim Speichern der Konfiguration ist ein Fehler aufgetreten.',
          icon: '/alert-icon.png',
        })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleBackupDownload() {
    try {
      const res = await fetch('/api/admin/backup-db')
      if (!res.ok) {
        let data = null
        try { data = await res.json() } catch {}
        toast({
          title: 'Fehler beim Backup',
          description: (data && data.error) || 'Beim Erstellen des Backups ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
        if (data && data.notify && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Fehler beim Backup', {
            body: (data && data.error) || 'Beim Erstellen des Backups ist ein Fehler aufgetreten.',
            icon: '/alert-icon.png',
          })
        }
        return
      }
      window.open('/api/admin/backup-db', '_blank')
    } catch (e: any) {
      toast({
        title: 'Fehler beim Backup',
        description: e?.message || 'Beim Erstellen des Backups ist ein Fehler aufgetreten.',
        variant: 'destructive',
      })
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Fehler beim Backup', {
          body: e?.message || 'Beim Erstellen des Backups ist ein Fehler aufgetreten.',
          icon: '/alert-icon.png',
        })
      }
    }
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
    setResetting(true)
    try {
      const res = await fetch('/api/admin/factory-reset', { method: 'POST' })
      const data = await res.json()
      if (!data.success) {
        toast({
          title: 'Fehler beim Factory-Reset',
          description: data.message || 'Beim Zurücksetzen der Datenbank ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
        if (data.notify && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Fehler beim Factory-Reset', {
            body: data.message || 'Beim Zurücksetzen der Datenbank ist ein Fehler aufgetreten.',
            icon: '/alert-icon.png',
          })
        }
      } else {
        toast({
          title: 'Werkseinstellungen wiederhergestellt',
          description: 'Alle Daten wurden gelöscht. Die Seite wird neu geladen...',
          variant: 'default',
        })
        setTimeout(() => window.location.reload(), 2000)
      }
    } catch (e: any) {
      toast({
        title: 'Fehler beim Factory-Reset',
        description: e?.message || 'Beim Zurücksetzen der Datenbank ist ein Fehler aufgetreten.',
        variant: 'destructive',
      })
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Fehler beim Factory-Reset', {
          body: e?.message || 'Beim Zurücksetzen der Datenbank ist ein Fehler aufgetreten.',
          icon: '/alert-icon.png',
        })
      }
    } finally {
      setResetting(false)
    }
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
      // csvStatus will auto-refresh via hook polling
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
      const res = await fetch('/api/admin/correction-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rowToEdit.id, value: editValue, type: correctionType })
      })
      const data = await res.json()
      if (!data.success) {
        setCorrectionError(data.message || 'Fehler beim Speichern')
        toast({
          title: 'Fehler beim Speichern',
          description: data.message || 'Beim Speichern der Korrektur ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
        if (data.notify && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Fehler beim Speichern', {
            body: data.message || 'Beim Speichern der Korrektur ist ein Fehler aufgetreten.',
            icon: '/alert-icon.png',
          })
        }
      }
      setRowToEdit(null)
      setEditRow(null)
      setEditValue('')
      fetchCorrectionData()
      fetchCorrectionStats()
    } catch (e: any) {
      setCorrectionError(e?.message || 'Fehler beim Speichern')
      toast({
        title: 'Fehler beim Speichern',
        description: e?.message || 'Beim Speichern der Korrektur ist ein Fehler aufgetreten.',
        variant: 'destructive',
      })
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Fehler beim Speichern', {
          body: e?.message || 'Beim Speichern der Korrektur ist ein Fehler aufgetreten.',
          icon: '/alert-icon.png',
        })
      }
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteCorrection(row: any) {
    setShowDeleteDialog(false)
    setCorrectionLoading(true)
    try {
      const res = await fetch('/api/admin/correction-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, type: correctionType })
      })
      const data = await res.json()
      if (!data.success) {
        setCorrectionError(data.message || 'Fehler beim Löschen')
        toast({
          title: 'Fehler beim Löschen',
          description: data.message || 'Beim Löschen der Korrektur ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
        if (data.notify && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Fehler beim Löschen', {
            body: data.message || 'Beim Löschen der Korrektur ist ein Fehler aufgetreten.',
            icon: '/alert-icon.png',
          })
        }
      }
      fetchCorrectionData()
      fetchCorrectionStats()
    } catch (e: any) {
      setCorrectionError(e?.message || 'Fehler beim Löschen')
      toast({
        title: 'Fehler beim Löschen',
        description: e?.message || 'Beim Löschen der Korrektur ist ein Fehler aufgetreten.',
        variant: 'destructive',
      })
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Fehler beim Löschen', {
          body: e?.message || 'Beim Löschen der Korrektur ist ein Fehler aufgetreten.',
          icon: '/alert-icon.png',
        })
      }
    } finally {
      setCorrectionLoading(false)
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

  async function handleManualCsvImport() {
    setCsvError(null)
    setCsvUploading({})
    try {
      const res = await fetch('/api/process-csv', { method: 'POST' })
      const data = await res.json()
      if (!data.success) {
        setCsvError(data.error || 'Fehler beim CSV-Import')
        toast({
          title: 'Fehler beim CSV-Import',
          description: data.error || 'Beim Importieren der CSV-Dateien ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
        if (data.notify && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Fehler beim CSV-Import', {
            body: data.error || 'Beim Importieren der CSV-Dateien ist ein Fehler aufgetreten.',
            icon: '/alert-icon.png',
          })
        }
      }
    } catch (e: any) {
      setCsvError(e?.message || 'Fehler beim CSV-Import')
      toast({
        title: 'Fehler beim CSV-Import',
        description: e?.message || 'Beim Importieren der CSV-Dateien ist ein Fehler aufgetreten.',
        variant: 'destructive',
      })
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Fehler beim CSV-Import', {
          body: e?.message || 'Beim Importieren der CSV-Dateien ist ein Fehler aufgetreten.',
          icon: '/alert-icon.png',
        })
      }
    }
  }

  async function handleRebuildDb() {
    try {
      const res = await fetch('/api/admin/rebuild-db', { method: 'POST' })
      const data = await res.json()
      if (!data.success) {
        toast({
          title: 'Fehler beim Neuaufbau',
          description: data.message || 'Beim Neuaufbau der Datenbank ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
        if (data.notify && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Fehler beim Neuaufbau', {
            body: data.message || 'Beim Neuaufbau der Datenbank ist ein Fehler aufgetreten.',
            icon: '/alert-icon.png',
          })
        }
      }
    } catch (e: any) {
      toast({
        title: 'Fehler beim Neuaufbau',
        description: e?.message || 'Beim Neuaufbau der Datenbank ist ein Fehler aufgetreten.',
        variant: 'destructive',
      })
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Fehler beim Neuaufbau', {
          body: e?.message || 'Beim Neuaufbau der Datenbank ist ein Fehler aufgetreten.',
          icon: '/alert-icon.png',
        })
      }
    }
  }

  function setField(name: string, value: any) {
    setSettingsConfig((prev: any) => ({ ...prev, [name]: value }))
  }

  async function handleSettingsSave(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setSettingsSaving(true)
    setSettingsError(null)
    setSettingsSuccess(false)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsConfig)
      })
      if (!res.ok) throw new Error('Fehler beim Speichern')
      setSettingsSuccess(true)
    } catch (e: any) {
      setSettingsError(e.message || 'Unbekannter Fehler')
    } finally {
      setSettingsSaving(false)
    }
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
            <main className="flex-1 p-6 md:p-10 w-full min-h-screen">
              {segment === 'overview' && (
                <section className="space-y-8">
                  <h1 className="text-2xl font-bold mb-6">Admin Übersicht</h1>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {healthLoading && <LoadingSpinner text="Systemdaten werden geladen..." />}
                    {healthError && <ErrorMessage message={healthError} />}
                    {health && !healthLoading && !healthError && (
                      <>
                        <Card className="w-full p-6 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                          <CardHeader><CardTitle>Datenbank</CardTitle></CardHeader>
                          <CardContent>
                            <div className="text-sm">Größe: <b>{health.dbSize ? (health.dbSize/1024/1024).toFixed(2) : '-'} MB</b></div>
                            <div className="text-sm">Letztes Backup: <b>{health.lastBackup ? new Date(health.lastBackup).toLocaleString() : '-'}</b></div>
                          </CardContent>
                        </Card>
                        <Card className="w-full p-6 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                          <CardHeader><CardTitle>CSV-Watcher</CardTitle></CardHeader>
                          <CardContent>
                            <div className="text-sm">Status: <Badge className={health.watcherActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{health.watcherActive ? 'Aktiv' : 'Inaktiv'}</Badge></div>
                            <div className="text-sm">Letzter Heartbeat: <b>{health.watcherHeartbeat ? new Date(health.watcherHeartbeat).toLocaleString() : '-'}</b></div>
                            <div className="text-sm">CSV-Dateien: <b>{health.totalFiles ?? '-'}</b></div>
                          </CardContent>
                        </Card>
                        <Card className="w-full p-6 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                          <CardHeader><CardTitle>System</CardTitle></CardHeader>
                          <CardContent>
                            <div className="text-sm">Zeit: <b>{health.time ? new Date(health.time).toLocaleString() : '-'}</b></div>
                            <div className="text-sm">Speicher frei: <b>{health.diskFree ? (health.diskFree/1024/1024/1024).toFixed(2) : '-'} GB</b></div>
                            <div className="text-sm">Speicher gesamt: <b>{health.diskTotal ? (health.diskTotal/1024/1024/1024).toFixed(2) : '-'} GB</b></div>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </div>
                  <Card className="w-full mb-8 p-6 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Geplante Aufgaben (Cron)</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Aufgabe</TableHead><TableHead>Intervall</TableHead><TableHead>Letzter Lauf</TableHead><TableHead>Status</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {cronLoading && <LoadingSpinner text="Cron-Aufgaben werden geladen..." />}
                          {cronError && <ErrorMessage message={cronError} />}
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
                        {logsLoading && <LoadingSpinner text="Logs werden geladen..." />}
                        {logsError && <ErrorMessage message={logsError} />}
                        {logs.length === 0 && !logsLoading && !logsError ? <div className="text-gray-400">Keine Logs gefunden.</div> : logs.map((line, i) => <div key={i}>{line}</div>)}
                      </div>
                    </CardContent>
                  </Card>
                </section>
              )}
              {segment === 'thresholds' && config && config.thresholdsByStationAndTime && (
                <section className="space-y-12">
                  <h1 className="text-3xl font-extrabold tracking-tight mb-8 flex items-center gap-4 sticky top-0 z-10 bg-gradient-to-b from-white/80 to-transparent dark:from-gray-900/80 dark:to-transparent backdrop-blur-xl py-4 px-2 rounded-2xl shadow-lg">
                    <Settings2 className="w-8 h-8 text-violet-500" />
                    Schwellenwerte
                    <span className="text-base font-normal text-gray-400 ml-4">Grenzwerte & Zeitblöcke pro Station</span>
                  </h1>
                  {Object.entries(config.thresholdsByStationAndTime).map(([station, blocks], stationIdx) => (
                    <div key={station} className="space-y-8">
                      <h2 className={cn("flex items-center gap-3 text-2xl font-bold mb-6", stationIdx > 0 ? "mt-32" : "mt-12")}>
                        {station === 'ort' && <MapPin className="w-7 h-7 text-emerald-400" />}
                        {station === 'techno' && <Settings2 className="w-7 h-7 text-fuchsia-400" />}
                        {station === 'heuballern' && <Sun className="w-7 h-7 text-cyan-400" />}
                        {station === 'band' && <DatabaseZap className="w-7 h-7 text-orange-400" />}
                        <span className="capitalize">{station}</span>
                      </h2>
                      <div className="flex flex-col gap-8">
                        {(blocks as any[]).map((block, idx) => {
                          const isDay = block.from < block.to
                          return (
                            <div
                              key={idx}
                              className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl flex flex-col gap-6"
                              aria-label={`Zeitblock ${block.from} - ${block.to} (${isDay ? 'Tag' : 'Nacht'})`}
                            >
                              <h3 className="flex items-center gap-3 text-xl font-semibold mb-2">
                                {isDay ? <Sun className="w-6 h-6 text-yellow-400" /> : <Moon className="w-6 h-6 text-blue-400" />}
                                Zeitblock: {block.from} - {block.to}
                                <span className={cn("ml-2 px-3 py-1 rounded-full text-xs font-bold", isDay ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700")}>{isDay ? 'Tag' : 'Nacht'}</span>
                              </h3>
                              <form
                                className="grid grid-cols-1 md:grid-cols-2 gap-6"
                                onSubmit={e => { e.preventDefault(); handleSave(); }}
                                aria-label={`Schwellenwerte für ${block.from} - ${block.to}`}
                              >
                                <label className="flex flex-col gap-1">
                                  <span className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-500" /> Warnung</span>
                                  <input
                                    type="number"
                                    className="input input-lg focus:ring-2 focus:ring-yellow-400 rounded-lg border border-yellow-200 bg-white dark:bg-gray-900 px-4 py-2 text-lg font-semibold shadow-sm"
                                    value={block.warning}
                                    onChange={e => handleThresholdChange(station, idx, 'warning', Number(e.target.value))}
                                    min={0}
                                    aria-label="Warnung dB"
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Alarm</span>
                                  <input
                                    type="number"
                                    className="input input-lg focus:ring-2 focus:ring-red-400 rounded-lg border border-red-200 bg-white dark:bg-gray-900 px-4 py-2 text-lg font-semibold shadow-sm"
                                    value={block.alarm}
                                    onChange={e => handleThresholdChange(station, idx, 'alarm', Number(e.target.value))}
                                    min={0}
                                    aria-label="Alarm dB"
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">LAS</span>
                                  <input
                                    type="number"
                                    className="input input-lg focus:ring-2 focus:ring-emerald-400 rounded-lg border border-emerald-200 bg-white dark:bg-gray-900 px-4 py-2 text-lg font-semibold shadow-sm"
                                    value={block.las}
                                    onChange={e => handleThresholdChange(station, idx, 'las', Number(e.target.value))}
                                    min={0}
                                    aria-label="LAS dB"
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">LAF</span>
                                  <input
                                    type="number"
                                    className="input input-lg focus:ring-2 focus:ring-cyan-400 rounded-lg border border-cyan-200 bg-white dark:bg-gray-900 px-4 py-2 text-lg font-semibold shadow-sm"
                                    value={block.laf}
                                    onChange={e => handleThresholdChange(station, idx, 'laf', Number(e.target.value))}
                                    min={0}
                                    aria-label="LAF dB"
                                  />
                                </label>
                                <div className="flex gap-4 col-span-1 md:col-span-2">
                                  <label className="flex flex-col gap-1 flex-1">
                                    <span className="font-medium text-gray-700 dark:text-gray-200">Von</span>
                                    <input
                                      type="text"
                                      className="input input-lg focus:ring-2 focus:ring-violet-400 rounded-lg border border-violet-200 bg-white dark:bg-gray-900 px-4 py-2 text-lg font-semibold shadow-sm"
                                      value={block.from}
                                      onChange={e => handleThresholdChange(station, idx, 'from', e.target.value)}
                                      placeholder="HH:MM"
                                      aria-label="Von Uhrzeit"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1 flex-1">
                                    <span className="font-medium text-gray-700 dark:text-gray-200">Bis</span>
                                    <input
                                      type="text"
                                      className="input input-lg focus:ring-2 focus:ring-violet-400 rounded-lg border border-violet-200 bg-white dark:bg-gray-900 px-4 py-2 text-lg font-semibold shadow-sm"
                                      value={block.to}
                                      onChange={e => handleThresholdChange(station, idx, 'to', e.target.value)}
                                      placeholder="HH:MM"
                                      aria-label="Bis Uhrzeit"
                                    />
                                  </label>
                                </div>
                                <Button
                                  type="submit"
                                  className="mt-8 w-full py-3 text-lg font-bold rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg hover:scale-[1.02] transition-all"
                                  disabled={saving}
                                  aria-label="Schwellenwerte speichern"
                                >
                                  {saving ? 'Speichern...' : 'Speichern'}
                                </Button>
                                {configError && <div className="text-red-500 font-semibold text-sm mt-2">{configError}</div>}
                              </form>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              )}
              {segment === 'system' && (
                <section className="space-y-8">
                  <h1 className="text-2xl font-bold mb-6">System & Health</h1>
                  {!health && <div className="text-sm text-gray-500">Lade Systemdaten...</div>}
                  {health?.error && <div className="text-sm text-red-500">{health.error}</div>}
                  {health && !health.error && (
                    <>
                      <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                        <CardHeader><CardTitle>Datenbank</CardTitle></CardHeader>
                        <CardContent>
                          <div className="text-sm">Größe: <b>{health.dbSize ? (health.dbSize/1024/1024).toFixed(2) : '-'} MB</b></div>
                          <div className="text-sm">Letztes Backup: <b>{health.lastBackup ? new Date(health.lastBackup).toLocaleString() : '-'}</b></div>
                        </CardContent>
                      </Card>
                      <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                        <CardHeader><CardTitle>CSV-Watcher</CardTitle></CardHeader>
                        <CardContent>
                          <div className="text-sm">Status: <Badge className={health.watcherActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{health.watcherActive ? 'Aktiv' : 'Inaktiv'}</Badge></div>
                          <div className="text-sm">Letzter Heartbeat: <b>{health.watcherHeartbeat ? new Date(health.watcherHeartbeat).toLocaleString() : '-'}</b></div>
                        </CardContent>
                      </Card>
                      <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                        <CardHeader><CardTitle>System</CardTitle></CardHeader>
                        <CardContent>
                          <div className="text-sm">Zeit: <b>{health.time ? new Date(health.time).toLocaleString() : '-'}</b></div>
                          <div className="text-sm">Speicher frei: <b>{health.diskFree ? (health.diskFree/1024/1024/1024).toFixed(2) : '-'} GB</b></div>
                          <div className="text-sm">Speicher gesamt: <b>{health.diskTotal ? (health.diskTotal/1024/1024/1024).toFixed(2) : '-'} GB</b></div>
                        </CardContent>
                      </Card>
                      <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                        <CardHeader><CardTitle>API-Cache-Dauer</CardTitle></CardHeader>
                        <CardContent>
                          <SettingsForm
                            fields={[{
                              name: "apiCacheDuration",
                              label: "API-Cache-Dauer (Sekunden)",
                              type: "number",
                              value: config?.apiCacheDuration ?? 60,
                              onChange: v => setConfig((prev: any) => ({ ...prev, apiCacheDuration: v })),
                              min: 0,
                              max: 3600,
                              step: 1,
                            }]}
                            onSubmit={e => { e.preventDefault(); handleSave(); }}
                            submitLabel="Speichern"
                            loading={saving}
                            error={configError}
                          />
                          <span className="ml-2 text-sm text-gray-500">(0 = kein Caching, Standard: 60)</span>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </section>
              )}
              {segment === 'csv' && (
                <section className="space-y-8">
                  <h1 className="text-2xl font-bold mb-6">CSV & Import</h1>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Watcher-Status</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-sm">Status: <Badge className={csvStatus?.watcherActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{csvStatus?.watcherActive ? 'Aktiv' : 'Inaktiv'}</Badge></div>
                      <div className="text-sm">Letzter Heartbeat: <b>{csvStatus?.watcherHeartbeat ? new Date(csvStatus.watcherHeartbeat).toLocaleString() : '-'}</b></div>
                      <div className="text-sm">CSV-Dateien: <b>{csvStatus?.totalFiles ?? '-'}</b></div>
                    </CardContent>
                  </Card>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Factory Reset</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <Button onClick={handleFactoryReset} className="w-48 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold" size="lg" disabled={resetting}>
                        <Trash2 className="w-4 h-4 mr-2" /> {resetting ? 'Zurücksetzen...' : 'System zurücksetzen'}
                      </Button>
                      <div className="text-xs text-gray-500">Löscht alle Messwerte, Wetterdaten und CSV-Dateien unwiderruflich.</div>
                    </CardContent>
                  </Card>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Datenbank-Backup</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <Button onClick={handleBackupDownload} className="w-48 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold" size="lg">
                        <Download className="w-4 h-4 mr-2" /> Backup herunterladen
                      </Button>
                      <div className="text-xs text-gray-500">Das Backup enthält alle Messwerte, Wetterdaten und Konfigurationen.</div>
                    </CardContent>
                  </Card>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Factory Reset</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <Button onClick={handleFactoryReset} className="w-48 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold" size="lg" disabled={resetting}>
                        <Trash2 className="w-4 h-4 mr-2" /> {resetting ? 'Zurücksetzen...' : 'System zurücksetzen'}
                      </Button>
                      <div className="text-xs text-gray-500">Löscht alle Messwerte, Wetterdaten und CSV-Dateien unwiderruflich.</div>
                    </CardContent>
                  </Card>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                                      <Button size="sm" variant="destructive" onClick={() => handleDeleteCorrection(row)} className="ml-2"><Trash2 className="w-3 h-3" /></Button>
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
              {segment === 'settings' && settingsConfig && (
                <section className="space-y-12">
                  <h1 className="text-3xl font-extrabold tracking-tight mb-8 flex items-center gap-4 sticky top-0 z-10 bg-gradient-to-b from-white/80 to-transparent dark:from-gray-900/80 dark:to-transparent backdrop-blur-xl py-4 px-2 rounded-2xl shadow-lg">
                    <Settings className="w-8 h-8 text-violet-500" />
                    Einstellungen
                    <span className="text-base font-normal text-gray-400 ml-4">Globale System- und Chart-Optionen</span>
                  </h1>
                  <Card className="max-w-6xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Chart & Anzeige</CardTitle></CardHeader>
                    <CardContent>
                      <form onSubmit={handleSettingsSave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-2">
                          <Label>Maximale Datenpunkte pro Chart</Label>
                          <Input type="number" value={settingsConfig.chartLimit ?? 200} min={10} max={2000} step={1} onChange={e => setField("chartLimit", Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Standard-Seitengröße (Tabellen)</Label>
                          <Input type="number" value={settingsConfig.pageSize ?? 20} min={5} max={200} step={1} onChange={e => setField("pageSize", Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Standard-Intervall</Label>
                          <select value={settingsConfig.defaultInterval ?? "24h"} onChange={e => setField("defaultInterval", e.target.value)} className="input">
                            {(settingsConfig.allowedIntervals || ["24h", "7d"]).map((v: string) => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Standard-Granularität</Label>
                          <select value={settingsConfig.defaultGranularity ?? "15min"} onChange={e => setField("defaultGranularity", e.target.value)} className="input">
                            {(settingsConfig.allowedGranularities || ["1h", "15min", "10min", "5min", "1min"]).map((v: string) => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-2 md:col-span-2">
                          <Label>Erlaubte Intervalle (Komma-getrennt)</Label>
                          <Input type="text" value={(settingsConfig.allowedIntervals || ["24h", "7d"]).join(", ")} onChange={e => setField("allowedIntervals", e.target.value.split(",").map((s: string) => s.trim()))} />
                        </div>
                        <div className="flex flex-col gap-2 md:col-span-2">
                          <Label>Erlaubte Granularitäten (Komma-getrennt)</Label>
                          <Input type="text" value={(settingsConfig.allowedGranularities || ["1h", "15min", "10min", "5min", "1min"]).join(", ")} onChange={e => setField("allowedGranularities", e.target.value.split(",").map((s: string) => s.trim()))} />
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                  <Card className="max-w-6xl mx-auto w-full p-8 bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Chart-Farben</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {Object.entries(settingsConfig.chartColors || {}).filter(([k]) => k !== 'gradients').map(([key, value]) => (
                          <div key={key} className="flex flex-col gap-2">
                            <Label>Farbe für {key}</Label>
                            <Input type="text" value={value as string} onChange={e => setField("chartColors", { ...settingsConfig.chartColors, [key]: e.target.value })} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <div className="flex justify-end max-w-6xl mx-auto w-full mt-8">
                    <Button type="button" className="px-8 py-3 text-lg font-bold rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg hover:scale-[1.02] transition-all" onClick={handleSettingsSave} disabled={settingsSaving}>
                      {settingsSaving ? 'Speichern...' : 'Speichern'}
                    </Button>
                  </div>
                  {settingsError && <div className="text-red-500 font-semibold text-sm mt-2 text-center">{settingsError}</div>}
                  {settingsSuccess && <div className="text-green-600 font-semibold text-sm mt-2 text-center">Gespeichert!</div>}
                </section>
              )}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  )
} 