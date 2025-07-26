"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, HardDrive, Database as DbIcon, Pencil, Trash2, BarChart3, Settings, Search, Sun, Moon, MapPin, Settings2, DatabaseZap, Home, UploadCloud, Eye, Download, FileText } from "lucide-react"
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
import { SidebarMenu, SidebarMenuButton, SidebarProvider } from '@/components/ui/sidebar'
import { SettingsForm } from "@/components/SettingsForm"
import { useCsvWatcherStatus } from "@/hooks/useCsvWatcherStatus"
import { useHealth } from "@/hooks/useHealth"
import { useCron } from "@/hooks/useCron"
import { useLogs } from "@/hooks/useLogs"
import { ErrorMessage } from "@/components/ErrorMessage"
import { LoadingSpinner } from "@/components/LoadingSpinner"
import { cn } from '@/lib/utils'
import { useTheme } from "next-themes"
import { AdminMonitoringPanel } from '@/components/AdminMonitoringPanel'

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

export interface ThresholdBlock {
  from: string;
  to: string;
  warning: number;
  alarm: number;
  las: number;
  laf: number;
}

export interface CorrectionData {
  id: string | number;
  datetime?: string;
  value: string | number;
  time?: string;
}

export interface CorrectionStats {
  count: number;
  lastModified?: string;
}

export interface UndoData {
  id: string | number;
  value: string | number;
}

export interface SettingsConfig {
  chartVisibleLines: Record<string, string[]>;
  pageSize?: number;
  chartColors?: Record<string, string>;
  // ... weitere Settings-Felder
}

export interface Config {
  thresholdsByStationAndTime: Record<string, ThresholdBlock[]>;
  apiCacheDuration?: number;
  adminEmail?: string;
  // ... weitere Felder
}

function ThresholdsAuditTable() {
  const [rows, setRows] = useState<Array<{
    id: number
    station: string
    from_time: string
    to_time: string
    old_warning?: number
    old_alarm?: number
    new_warning?: number
    new_alarm?: number
    changed_at: string
    changed_by?: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [station, setStation] = useState<string>('')
  const [action, setAction] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const fetchAudit = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (station) params.append('station', station)
    if (action) params.append('action', action)
    if (search) params.append('search', search)
    if (dateFrom) params.append('from', dateFrom)
    if (dateTo) params.append('to', dateTo)
    fetch('/api/admin/thresholds/audit?' + params.toString())
      .then(res => res.json())
      .then(data => {
        setRows(data.rows || [])
        setLoading(false)
      })
      .catch(e => {
        setError(e.message || 'Fehler beim Laden des Audit-Logs')
        setLoading(false)
      })
  }, [station, action, search, dateFrom, dateTo])
  useEffect(() => { fetchAudit() }, [fetchAudit])

  function exportCSV() {
    if (!rows.length) return
    const header = ['Zeit','Station','Zeitblock','Aktion','Warnung alt','Warnung neu','Alarm alt','Alarm neu','LAS alt','LAS neu','LAF alt','LAF neu']
    const csv = [header.join(',')].concat(rows.map(row => [
      new Date(row.changed_at).toLocaleString(),
      row.station,
      `${row.from_time} – ${row.to_time}`,
      row.action,
      row.old_warning ?? '', row.new_warning ?? '',
      row.old_alarm ?? '', row.new_alarm ?? '',
      row.old_las ?? '', row.new_las ?? '',
      row.old_laf ?? '', row.new_laf ?? ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'thresholds-audit.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  function exportJSON() {
    if (!rows.length) return
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'thresholds-audit.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // UI für Filter
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <div>
          <label className="block text-xs font-semibold mb-1">Station</label>
          <select value={station} onChange={e => setStation(e.target.value)} className="border rounded px-2 py-1 text-xs">
            <option value="">Alle</option>
            <option value="ort">Ort</option>
            <option value="techno">Techno</option>
            <option value="heuballern">Heuballern</option>
            <option value="band">Band</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Aktion</label>
          <select value={action} onChange={e => setAction(e.target.value)} className="border rounded px-2 py-1 text-xs">
            <option value="">Alle</option>
            <option value="insert">Insert</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Von</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded px-2 py-1 text-xs" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Bis</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded px-2 py-1 text-xs" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold mb-1">Suche</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Zeitblock, Wert..." className="border rounded px-2 py-1 text-xs w-full" />
        </div>
        <button onClick={fetchAudit} className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-3 py-1 rounded text-xs font-semibold" aria-label="Audit-Daten filtern">Filtern</button>
        <button onClick={exportCSV} className="ml-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-3 py-1 rounded text-xs font-semibold" aria-label="Audit-Daten als CSV exportieren">Export CSV</button>
        <button onClick={exportJSON} className="ml-2 bg-gradient-to-r from-gray-500 to-gray-700 text-white px-3 py-1 rounded text-xs font-semibold" aria-label="Audit-Daten als JSON exportieren">Export JSON</button>
      </div>
      {/* ... bestehende Tabelle ... */}
      {/* ... existing code ... */}
    </div>
  )
}

export default function AdminDashboard() {
  // Segment-Auswahl für die Sidebar
  const [segment, setSegment] = useState<'overview'|'thresholds'|'system'|'csv'|'backup'|'correction'|'settings'>('overview')
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { health, loading: healthLoading, error: healthError } = useHealth()
  const { cron, loading: cronLoading, error: cronError } = useCron()
  const { logs, loading: logsLoading, error: logsError } = useLogs()
  const { watcherStatus: csvStatus } = useCsvWatcherStatus()
  const [backupUploading, setBackupUploading] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState<string|null>(null)
  const [resetting, setResetting] = useState(false)
  const [csvUploading, setCsvUploading] = useState<{[station: string]: boolean}>({})
  const [csvError, setCsvError] = useState<string|null>(null)
  const [correctionQuery, setCorrectionQuery] = useState('')
  const [correctionStation, setCorrectionStation] = useState('ort')
  const [correctionType, setCorrectionType] = useState<'measurement'|'weather'>('measurement')
  const [correctionData, setCorrectionData] = useState<CorrectionData[]>([])
  const [correctionLoading, setCorrectionLoading] = useState(false)
  const [correctionError, setCorrectionError] = useState<string|null>(null)
  const [correctionStats, setCorrectionStats] = useState<CorrectionStats | null>(null)
  const [editRow, setEditRow] = useState<CorrectionData | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const { toast } = useToast()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [rowToDelete, setRowToDelete] = useState<CorrectionData | null>(null)
  const [undoData, setUndoData] = useState<UndoData | null>(null)
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [rowToEdit, setRowToEdit] = useState<CorrectionData | null>(null)
  const [configError, setConfigError] = useState<string|null>(null)
  const [editTimeSheet, setEditTimeSheet] = useState(false)
  const [editTimeStation, setEditTimeStation] = useState<string|null>(null)
  const [editTimeIdx, setEditTimeIdx] = useState<number|null>(null)
  const [editTimeFrom, setEditTimeFrom] = useState('08:00')
  const [editTimeTo, setEditTimeTo] = useState('20:00')
  // Verschiebe die States und Hilfsfunktionen aus AdminSettings in den Hauptbereich:
  const [settingsConfig, setSettingsConfig] = useState<SettingsConfig | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string|null>(null)
  const [settingsSuccess, setSettingsSuccess] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [importRunning, setImportRunning] = useState(false)

  // Optional: Import-Status aus dem LocalStorage oder API holen, falls mehrere Admins
  useEffect(() => {
    // Reset beim Laden
    setImportRunning(false)
  }, [])

  useEffect(() => { 
    setMounted(true) 
  }, [])

  // Verschiebe fetchCorrectionStats und fetchCorrectionData direkt vor die useEffect, die sie verwendet.
  const fetchCorrectionStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/correction-stats?station=${correctionStation}&type=${correctionType}`)
      setCorrectionStats(await res.json())
    } catch (e) {
      setCorrectionError(e instanceof Error ? e.message : String(e) || 'Fehler beim Laden der Statistiken')
    }
  }, [correctionStation, correctionType])

  const fetchCorrectionData = useCallback(async () => {
    setCorrectionLoading(true)
    setCorrectionError(null)
    try {
      const res = await fetch(`/api/admin/correction-data?station=${correctionStation}&type=${correctionType}&q=${encodeURIComponent(correctionQuery)}`)
      setCorrectionData(await res.json())
    } catch (e) {
      setCorrectionError(e instanceof Error ? e.message : String(e) || 'Fehler beim Laden der Daten')
    } finally {
      setCorrectionLoading(false)
    }
  }, [correctionStation, correctionType, correctionQuery])

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
  }, [segment, health, fetchCorrectionData, fetchCorrectionStats, toast])

  function handleThresholdChange(station: string, idx: number, key: string, value: number | string) {
    setConfig((prev: Config | null) => {
      if (!prev) return { thresholdsByStationAndTime: {} };
      const updated = { ...prev };
      updated.thresholdsByStationAndTime = { ...prev.thresholdsByStationAndTime };
      
      // Ensure only two blocks per station (day and night)
      if (!updated.thresholdsByStationAndTime[station]) {
        updated.thresholdsByStationAndTime[station] = [
          { from: '10:00', to: '22:00', warning: 52, alarm: 55, las: 50, laf: 52 }, // Day
          { from: '22:00', to: '10:00', warning: 42, alarm: 45, las: 48, laf: 50 }   // Night
        ];
      }
      
      // Ensure exactly 2 blocks
      if (updated.thresholdsByStationAndTime[station].length !== 2) {
        updated.thresholdsByStationAndTime[station] = [
          { from: '10:00', to: '22:00', warning: 52, alarm: 55, las: 50, laf: 52 }, // Day
          { from: '22:00', to: '10:00', warning: 42, alarm: 45, las: 48, laf: 50 }   // Night
        ];
      }
      
      updated.thresholdsByStationAndTime[station] = updated.thresholdsByStationAndTime[station].map((block: ThresholdBlock, i: number) =>
        i === idx ? { ...block, [key]: value } : block
      );
      return updated;
    });
  }

  async function handleSave() {
    setSaving(true)
    setConfigError(null)
    // E-Mail-Validierung
    if (config?.adminEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.adminEmail)) {
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        setConfigError(e.message || 'Fehler beim Speichern.')
        toast({
          title: 'Fehler beim Speichern',
          description: e.message || 'Beim Speichern der Konfiguration ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Fehler beim Speichern', {
            body: e.message || 'Beim Speichern der Konfiguration ist ein Fehler aufgetreten.',
            icon: '/alert-icon.png',
          })
        }
      } else {
        setConfigError('Fehler beim Speichern.')
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast({
          title: 'Fehler beim Backup',
          description: e.message || 'Beim Erstellen des Backups ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Fehler beim Backup', {
            body: e.message || 'Beim Erstellen des Backups ist ein Fehler aufgetreten.',
            icon: '/alert-icon.png',
          })
        }
      } else {
        toast({
          title: 'Fehler beim Backup',
          description: 'Beim Erstellen des Backups ist ein Fehler aufgetreten.',
          variant: 'destructive',
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast({
          title: 'Fehler beim Factory-Reset',
          description: e.message || 'Beim Zurücksetzen der Datenbank ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Fehler beim Factory-Reset', {
            body: e.message || 'Beim Zurücksetzen der Datenbank ist ein Fehler aufgetreten.',
            icon: '/alert-icon.png',
          })
        }
      } else {
        toast({
          title: 'Fehler beim Factory-Reset',
          description: 'Beim Zurücksetzen der Datenbank ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
      }
    } finally {
      setResetting(false)
    }
  }

  async function handleResetMeasurements() {
    setResetting(true)
    try {
      const res = await fetch('/api/admin/reset-measurements', { method: 'POST' })
      const data = await res.json()
      if (!data.success) {
        toast({
          title: 'Fehler beim Zurücksetzen der Messdaten',
          description: data.message || 'Beim Zurücksetzen der Messdaten ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
        if (data.notify && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Fehler beim Zurücksetzen der Messdaten', {
            body: data.message || 'Beim Zurücksetzen der Messdaten ist ein Fehler aufgetreten.',
            icon: '/alert-icon.png',
          })
        }
      } else {
        toast({
          title: 'Messdaten zurückgesetzt',
          description: `${data.message} Die Seite wird neu geladen...`,
          variant: 'default',
        })
        setTimeout(() => window.location.reload(), 2000)
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast({
          title: 'Fehler beim Zurücksetzen der Messdaten',
          description: e.message || 'Beim Zurücksetzen der Messdaten ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Fehler beim Zurücksetzen der Messdaten', {
            body: e.message || 'Beim Zurücksetzen der Messdaten ist ein Fehler aufgetreten.',
            icon: '/alert-icon.png',
          })
        }
      } else {
        toast({
          title: 'Fehler beim Zurücksetzen der Messdaten',
          description: 'Beim Zurücksetzen der Messdaten ist ein Fehler aufgetreten.',
          variant: 'destructive',
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        setCsvError(e.message || 'Fehler beim Upload')
      } else {
        setCsvError('Fehler beim Upload')
      }
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        setCorrectionError(e.message || 'Fehler beim Speichern')
      } else {
        setCorrectionError('Fehler beim Speichern')
      }
    } finally {
      setEditSaving(false)
    }
  }
  async function handleDelete(row: CorrectionData) {
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
      if (undoTimeout) clearTimeout(undoTimeout)
      setUndoTimeout(null)
      toast({
        title: 'Gelöscht',
        description: 'Datensatz wurde gelöscht.',
        action: <ToastAction altText="Rückgängig" onClick={undoDelete}>Rückgängig</ToastAction>,
        duration: 5000
      })
      fetchCorrectionData()
      fetchCorrectionStats()
    } catch (e: unknown) {
      if (e instanceof Error) {
        setCorrectionError(e.message || 'Fehler beim Löschen')
      } else {
        setCorrectionError('Fehler beim Löschen')
      }
    }
  }
  async function undoDelete() {
    if (!undoData) return
    if (undoTimeout) clearTimeout(undoTimeout)
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        setCorrectionError(e.message || 'Fehler beim Wiederherstellen')
      } else {
        setCorrectionError('Fehler beim Wiederherstellen')
      }
    }
  }
  function handleEdit(row: CorrectionData) {
    setRowToEdit(row)
    setEditValue(String(row.value))
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        setCorrectionError(e.message || 'Fehler beim Speichern')
      } else {
        setCorrectionError('Fehler beim Speichern')
      }
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

  async function handleDeleteCorrection(row: CorrectionData) {
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        setCorrectionError(e.message || 'Fehler beim Löschen')
      } else {
        setCorrectionError('Fehler beim Löschen')
      }
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
    setConfig((prev: Config | null) => {
      if (!prev) return { thresholdsByStationAndTime: {} };
      const updated = { ...prev };
      updated.thresholdsByStationAndTime = { ...prev.thresholdsByStationAndTime };
      updated.thresholdsByStationAndTime[editTimeStation] = updated.thresholdsByStationAndTime[editTimeStation].map((block: ThresholdBlock, i: number) =>
        i === editTimeIdx ? { ...block, from: editTimeFrom, to: editTimeTo } : block
      );
      return updated;
    });
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        setCsvError(e.message || 'Fehler beim CSV-Import')
      } else {
        setCsvError('Fehler beim CSV-Import')
      }
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast({
          title: 'Fehler beim Neuaufbau',
          description: e.message || 'Beim Neuaufbau der Datenbank ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Fehler beim Neuaufbau', {
            body: e.message || 'Beim Neuaufbau der Datenbank ist ein Fehler aufgetreten.',
            icon: '/alert-icon.png',
          })
        }
      } else {
        toast({
          title: 'Fehler beim Neuaufbau',
          description: 'Beim Neuaufbau der Datenbank ist ein Fehler aufgetreten.',
          variant: 'destructive',
        })
      }
    }
  }

  function setField(name: string, value: unknown) {
    setSettingsConfig((prev: SettingsConfig | null) => {
      if (!prev) return { chartVisibleLines: {} };
      return { ...prev, [name]: value };
    });
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        setSettingsError(e.message || 'Unbekannter Fehler')
      } else {
        setSettingsError('Unbekannter Fehler')
      }
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
                  <DbIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent truncate block">
                  Wood-One Live
                </span>
                <span className="ml-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex-shrink-0">Admin</span>
              </div>
            </div>
            {/* Navigation */}
            <nav className="flex-1 px-6 py-10 flex flex-col justify-between space-y-4">
              <div>
                <SidebarMenu>
                  <SidebarMenuButton isActive={segment==='overview'} onClick={()=>setSegment('overview')}
                    className="transition-all duration-200 group flex items-center rounded-2xl text-sm font-medium relative px-5 py-4 text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-violet-500 data-[active=true]:to-purple-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-violet-500/25">
                    <DbIcon className="w-4 h-4" /> Übersicht
                  </SidebarMenuButton>
                  <SidebarMenuButton isActive={segment==='thresholds'} onClick={()=>setSegment('thresholds')}
                    className="transition-all duration-200 group flex items-center rounded-2xl text-sm font-medium relative px-5 py-4 text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-violet-500 data-[active=true]:to-purple-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-violet-500/25">
                    <Settings2 className="w-4 h-4" /> Schwellenwerte
                  </SidebarMenuButton>
                  <SidebarMenuButton isActive={segment==='system'} onClick={()=>setSegment('system')}
                    className="transition-all duration-200 group flex items-center rounded-2xl text-sm font-medium relative px-5 py-4 text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-violet-500 data-[active=true]:to-purple-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-violet-500/25">
                    <BarChart3 className="w-4 h-4" /> System & Health
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
              </div>
              <div className="mt-10 mb-2 flex flex-col items-center gap-4">
                <SidebarMenu>
                  <SidebarMenuButton asChild>
                    <a href="/dashboard/all" className="transition-all duration-200 group flex items-center rounded-2xl text-sm font-medium relative px-5 py-4 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
                      <Home className="w-4 h-4 mr-2" /> Zurück zum Dashboard
                    </a>
                  </SidebarMenuButton>
                </SidebarMenu>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="p-3 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50 rounded-xl transition-all duration-200"
                        aria-label="Ansicht wechseln: Hell/Dunkel"
                      >
                        {!mounted ? null : theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Ansicht wechseln: Hell/Dunkel</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
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
                    {healthLoading && <LoadingSpinner text="Systemdaten werden geladen..." className="col-span-full" />}
                    {healthError && <ErrorMessage message={healthError} />}
                    {health && !healthLoading && !healthError && (
                      <>
                        <Card className="w-full p-6 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                          <CardHeader><CardTitle>Datenbank</CardTitle></CardHeader>
                          <CardContent>
                            <div className="text-sm">Größe: <b>{health.dbSize ? (health.dbSize/1024/1024).toFixed(2) : '-'} MB</b></div>
                            <div className="text-sm">Letztes Backup: <b>{health.lastBackup ? new Date(health.lastBackup).toLocaleString() : '-'}</b></div>
                          </CardContent>
                        </Card>
                        <Card className="w-full p-6 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                          <CardHeader><CardTitle>CSV-Watcher</CardTitle></CardHeader>
                          <CardContent>
                            <div className="text-sm">Status: <Badge className={health.watcherActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{health.watcherActive ? 'Aktiv' : 'Inaktiv'}</Badge></div>
                            <div className="text-sm">Letzter Heartbeat: <b>{health.watcherHeartbeat ? new Date(health.watcherHeartbeat).toLocaleString() : '-'}</b></div>
                            <div className="text-sm">CSV-Dateien: <b>{health.totalFiles ?? '-'}</b></div>
                          </CardContent>
                        </Card>
                        <Card className="w-full p-6 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                  <Card className="w-full mb-8 p-6 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Geplante Aufgaben (Cron)</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Aufgabe</TableHead><TableHead>Intervall</TableHead><TableHead>Letzter Lauf</TableHead><TableHead>Status</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {cronLoading && (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <LoadingSpinner text="Cron-Aufgaben werden geladen..." />
                              </TableCell>
                            </TableRow>
                          )}
                          {cronError && (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <ErrorMessage message={cronError} />
                              </TableCell>
                            </TableRow>
                          )}
                          {cron?.crons?.map((c: { name: string; schedule: string; lastRun?: string; nextRun?: string }, i: number) => (
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
                  <Card className="max-w-6xl mx-auto w-full mb-8 p-6 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                  {Object.entries(config.thresholdsByStationAndTime).map(([station, blocks], stationIdx) => {
                    // Default-Blöcke pro Station
                    const defaultBlocks: ThresholdBlock[] =
                      station === 'ort' ? [
                        { from: '10:00', to: '22:00', warning: 52, alarm: 55, las: 50, laf: 52 },
                        { from: '22:00', to: '10:00', warning: 42, alarm: 45, las: 48, laf: 50 }
                      ] :
                      station === 'techno' ? [
                        { from: '10:00', to: '22:00', warning: 77, alarm: 80, las: 75, laf: 77 },
                        { from: '22:00', to: '10:00', warning: 77, alarm: 80, las: 75, laf: 77 }
                      ] :
                      station === 'heuballern' ? [
                        { from: '10:00', to: '22:00', warning: 84, alarm: 87, las: 82, laf: 84 },
                        { from: '22:00', to: '10:00', warning: 80, alarm: 83, las: 78, laf: 80 }
                      ] :
                      station === 'band' ? [
                        { from: '10:00', to: '22:00', warning: 95, alarm: 98, las: 93, laf: 95 },
                        { from: '22:00', to: '10:00', warning: 92, alarm: 95, las: 90, laf: 92 }
                      ] : [];
                    // Ergänze fehlende Blöcke
                    let showBlocks = Array.isArray(blocks) ? [...blocks] : [];
                    if (showBlocks.length < 2) {
                      // Füge fehlende Blöcke aus Default hinzu
                      for (let i = showBlocks.length; i < 2; i++) {
                        showBlocks.push(defaultBlocks[i]);
                      }
                    }
                    showBlocks = showBlocks.slice(0, 2);
                    return (
                      <div key={station} className="space-y-8">
                        <h2 className={cn("flex items-center gap-3 text-2xl font-bold mb-6", stationIdx > 0 ? "mt-32" : "mt-12")}>
                          {station === 'ort' && <MapPin className="w-7 h-7 text-emerald-400" />}
                          {station === 'techno' && <Settings2 className="w-7 h-7 text-fuchsia-400" />}
                          {station === 'heuballern' && <Sun className="w-7 h-7 text-cyan-400" />}
                          {station === 'band' && <DatabaseZap className="w-7 h-7 text-orange-400" />}
                          <span className="capitalize">{station}</span>
                          <Badge className="ml-2 bg-blue-100 text-blue-700 text-xs">2 Blöcke: Tag & Nacht</Badge>
                        </h2>
                        
                        {/* Validation message if more than 2 blocks */}
                        {(blocks as ThresholdBlock[]).length > 2 && (
                          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
                            <strong>Warnung:</strong> Nur 2 Blöcke (Tag und Nacht) sind erlaubt. Überschüssige Blöcke werden automatisch entfernt.
                          </div>
                        )}
                        
                        <div className="flex flex-col gap-8">
                          {showBlocks.map((block, idx) => {
                            const isDay = block.from < block.to
                            const blockType = idx === 0 ? 'Tag' : 'Nacht'
                            return (
                              <div
                                key={idx}
                                className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl flex flex-col gap-6"
                                aria-label={`${blockType}-Block ${block.from} - ${block.to}`}
                              >
                                <h3 className="flex items-center gap-3 text-xl font-semibold mb-2">
                                  {isDay ? <Sun className="w-6 h-6 text-yellow-400" /> : <Moon className="w-6 h-6 text-blue-400" />}
                                  {blockType}-Block: {block.from} - {block.to}
                                  <span className={cn("ml-2 px-3 py-1 rounded-full text-xs font-bold", isDay ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700")}>{blockType}</span>
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
                    )
                  })}
                </section>
              )}
              {segment === 'system' && (
                <section className="space-y-8">
                  <h1 className="text-2xl font-bold mb-6">System & Health</h1>
                  {!health && <div className="text-sm text-gray-500">Lade Systemdaten...</div>}
                  {health?.error && <div className="text-sm text-red-500">{health.error}</div>}
                  {health && !health.error && (
                    <>
                      <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                        <CardHeader><CardTitle>Datenbank</CardTitle></CardHeader>
                        <CardContent>
                          <div className="text-sm">Größe: <b>{health.dbSize ? (health.dbSize/1024/1024).toFixed(2) : '-'} MB</b></div>
                          <div className="text-sm">Letztes Backup: <b>{health.lastBackup ? new Date(health.lastBackup).toLocaleString() : '-'}</b></div>
                        </CardContent>
                      </Card>
                      <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                        <CardHeader><CardTitle>CSV-Watcher</CardTitle></CardHeader>
                        <CardContent>
                          <div className="text-sm">Status: <Badge className={health.watcherActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{health.watcherActive ? 'Aktiv' : 'Inaktiv'}</Badge></div>
                          <div className="text-sm">Letzter Heartbeat: <b>{health.watcherHeartbeat ? new Date(health.watcherHeartbeat).toLocaleString() : '-'}</b></div>
                        </CardContent>
                      </Card>
                      <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                        <CardHeader><CardTitle>System</CardTitle></CardHeader>
                        <CardContent>
                          <div className="text-sm">Zeit: <b>{health.time ? new Date(health.time).toLocaleString() : '-'}</b></div>
                          <div className="text-sm">Speicher frei: <b>{health.diskFree ? (health.diskFree/1024/1024/1024).toFixed(2) : '-'} GB</b></div>
                          <div className="text-sm">Speicher gesamt: <b>{health.diskTotal ? (health.diskTotal/1024/1024/1024).toFixed(2) : '-'} GB</b></div>
                        </CardContent>
                      </Card>
                      {/* Monitoring-Panel für Prometheus-Metriken */}
                      <Card className="w-full max-w-6xl mx-auto mb-8 p-6 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                        <CardHeader><CardTitle>System Monitoring (Prometheus)</CardTitle></CardHeader>
                        <CardContent>
                          <AdminMonitoringPanel />
                        </CardContent>
                      </Card>
                      <Card className="w-full max-w-6xl mx-auto mb-8 p-6 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                        <CardHeader><CardTitle>Schwellenwert-Änderungen (Audit-Log)</CardTitle></CardHeader>
                        <CardContent>
                          <ThresholdsAuditTable />
                        </CardContent>
                      </Card>
                    </>
                  )}
                </section>
              )}
              {segment === 'csv' && (
                <section className="space-y-8">
                  <h1 className="text-2xl font-bold mb-6">CSV & Import</h1>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>CSV-Watcher & Rebuild</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="text-sm">Status: <Badge className={csvStatus?.watcherActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{csvStatus?.watcherActive ? 'Aktiv' : 'Inaktiv'}</Badge></div>
                        <Button onClick={async () => {
                          setLoading(true)
                          try {
                            const res = await fetch('/api/process-csv', { method: 'POST' })
                            const data = await res.json()
                            toast({ title: data.success ? 'CSV-Import abgeschlossen' : 'Fehler beim Import', description: data.message || data.error, variant: data.success ? 'default' : 'destructive' })
                          } catch (e: unknown) {
                            toast({ title: 'Fehler beim Import', description: e instanceof Error ? e.message : 'Unbekannter Fehler', variant: 'destructive' })
                          } finally {
                            setLoading(false)
                          }
                        }} disabled={loading || importRunning} className="ml-4">
                          {loading ? <span className="animate-spin mr-2">⏳</span> : null}
                          CSV-Dateien neu einlesen
                        </Button>
                        <Button onClick={async () => {
                          setImportRunning(true)
                          setLoading(true)
                          try {
                            const res = await fetch('/api/admin/import-csv-data', { method: 'POST' })
                            const data = await res.json()
                            if (data.success) {
                              toast({ 
                                title: 'Vollständiger Import abgeschlossen', 
                                description: `${data.stats.newMeasurements} Messwerte, ${data.stats.weatherFetched} Wetterdaten importiert`, 
                                variant: 'default' 
                              })
                            } else {
                              toast({ title: 'Fehler beim Import', description: data.message, variant: 'destructive' })
                            }
                          } catch (e: unknown) {
                            toast({ title: 'Fehler beim Import', description: e instanceof Error ? e.message : 'Unbekannter Fehler', variant: 'destructive' })
                          } finally {
                            setLoading(false)
                            setImportRunning(false)
                          }
                        }} disabled={loading || importRunning} variant="destructive">
                          {importRunning ? <span className="animate-spin mr-2">⏳</span> : null}
                          DB leeren & Vollimport
                        </Button>
                      </div>
                      <div className="text-xs text-gray-500">Der CSV-Watcher überwacht die Ordner und importiert neue Dateien automatisch. Mit diesem Button werden alle CSV-Dateien erneut eingelesen (Rebuild).</div>
                    </CardContent>
                  </Card>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>CSV-Dateien & Upload</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      {csvError && <div className="text-xs text-red-500">{csvError}</div>}
                      <div className="grid grid-cols-1 gap-4">
                        {csvStatus?.watchedDirectories?.map((dir: WatchedDirectory) => (
                          <div key={dir.station} className="border rounded-xl p-4 bg-white/90 dark:bg-gray-900/80">
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
                              {dir.files.length === 0 ? <div className="text-gray-400">Keine Dateien</div> : dir.files.map((file: CSVFile) => (
                                <div key={file.name} className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 py-1">
                                  <span>{file.name}</span>
                                  <span className="text-gray-400 ml-2">{new Date(file.modified).toLocaleString()}</span>
                                  <a href={`/csv/${dir.station}/${file.name}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-500 hover:underline"><Eye className="w-3 h-3 inline" /></a>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Watcher-Status</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-sm">Status: <Badge className={csvStatus?.watcherActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{csvStatus?.watcherActive ? 'Aktiv' : 'Inaktiv'}</Badge></div>
                      <div className="text-sm">Letzter Heartbeat: <b>{csvStatus?.watcherHeartbeat ? new Date(csvStatus.watcherHeartbeat).toLocaleString() : '-'}</b></div>
                      <div className="text-sm">CSV-Dateien: <b>{csvStatus?.totalFiles ?? '-'}</b></div>
                    </CardContent>
                  </Card>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Factory Reset</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <Button onClick={handleFactoryReset} className="w-48 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold" size="lg" disabled={resetting}>
                        <Trash2 className="w-4 h-4 mr-2" /> {resetting ? 'Zurücksetzen...' : 'System zurücksetzen'}
                      </Button>
                      <div className="text-xs text-gray-500">Löscht alle Messwerte, Wetterdaten und CSV-Dateien unwiderruflich.</div>
                    </CardContent>
                  </Card>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Messdaten zurücksetzen</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <Button onClick={handleResetMeasurements} className="w-48 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold" size="lg" disabled={resetting}>
                        <BarChart3 className="w-4 h-4 mr-2" /> {resetting ? 'Zurücksetzen...' : 'Messdaten zurücksetzen'}
                      </Button>
                      <div className="text-xs text-gray-500">Löscht nur Messwerte und CSV-Dateien. Wetterdaten bleiben erhalten.</div>
                    </CardContent>
                  </Card>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Backup-Plan</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-sm">Tägliches automatisches Backup um 03:00 Uhr (siehe <code>backups/</code> Verzeichnis).</div>
                    </CardContent>
                  </Card>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Datenbank zurücksetzen (Rebuild DB)</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center gap-4">
                        <Button variant="destructive" onClick={async () => {
                          if (!window.confirm('Möchtest du wirklich alle Messwerte und Wetterdaten löschen und die Datenbank neu aufbauen?')) return;
                          setLoading(true)
                          try {
                            const res = await fetch('/api/admin/rebuild-db', { method: 'POST' })
                            const data = await res.json()
                            toast({ title: data.success ? 'Datenbank neu aufgebaut' : 'Fehler beim Neuaufbau', description: data.message, variant: data.success ? 'default' : 'destructive' })
                          } catch (e: unknown) {
                            const errorMessage = e instanceof Error ? e.message : 'Fehler beim Neuaufbau'
                            toast({ title: 'Fehler beim Neuaufbau', description: errorMessage, variant: 'destructive' })
                          } finally {
                            setLoading(false)
                          }
                        }} disabled={loading}>Datenbank zurücksetzen</Button>
                      </div>
                      <div className="text-xs text-gray-500">Löscht alle Messwerte und Wetterdaten unwiderruflich und baut die Tabellenstruktur neu auf. Nutze danach "Alle CSV-Dateien neu einlesen" für einen vollständigen Reimport.</div>
                    </CardContent>
                  </Card>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Wetterdaten manuell aktualisieren</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center gap-4">
                        <Button onClick={async () => {
                          setLoading(true)
                          try {
                            const res = await fetch('/api/weather?station=global', { method: 'POST' })
                            const data = await res.json()
                            toast({ title: data.success ? 'Wetterdaten aktualisiert' : 'Fehler beim Wetter-Update', description: data.success ? JSON.stringify(data) : data.error, variant: data.success ? 'default' : 'destructive' })
                          } catch (e: unknown) {
                            const errorMessage = e instanceof Error ? e.message : 'Fehler beim Wetter-Update'
                            toast({ title: 'Fehler beim Wetter-Update', description: errorMessage, variant: 'destructive' })
                          } finally {
                            setLoading(false)
                          }
                        }} disabled={loading}>Wetter jetzt abrufen</Button>
                      </div>
                      <div className="text-xs text-gray-500">Ruft die aktuellen Wetterdaten manuell ab und speichert sie in der Datenbank. Automatische Updates erfolgen alle 10 Minuten.</div>
                    </CardContent>
                  </Card>
                </section>
              )}
              {segment === 'backup' && (
                <section className="space-y-8">
                  <h1 className="text-2xl font-bold mb-6">Backup & Restore</h1>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Datenbank-Backup</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <Button onClick={handleBackupDownload} className="w-48 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold" size="lg">
                        <Download className="w-4 h-4 mr-2" /> Backup herunterladen
                      </Button>
                      <div className="text-xs text-gray-500">Das Backup enthält alle Messwerte, Wetterdaten und Konfigurationen.</div>
                    </CardContent>
                  </Card>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Factory Reset</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <Button onClick={handleFactoryReset} className="w-48 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold" size="lg" disabled={resetting}>
                        <Trash2 className="w-4 h-4 mr-2" /> {resetting ? 'Zurücksetzen...' : 'System zurücksetzen'}
                      </Button>
                      <div className="text-xs text-gray-500">Löscht alle Messwerte, Wetterdaten und CSV-Dateien unwiderruflich.</div>
                    </CardContent>
                  </Card>
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                        <Select value={correctionType} onValueChange={v => setCorrectionType(v as 'measurement' | 'weather')}>
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
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                  <Card className="w-full min-w-[min(100vw,900px)] max-w-[1200px] mx-auto p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
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
                  <Card className="max-w-6xl mx-auto w-full p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Chart & Anzeige</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-gray-500 text-xs mb-6">Hier kannst du globale Anzeige- und Chart-Optionen für das Dashboard festlegen. Änderungen wirken sich auf alle Nutzer aus.</p>
                      <form onSubmit={handleSettingsSave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-2">
                          <Label>Standard-Seitengröße (Tabellen)</Label>
                          <Input type="number" value={settingsConfig.pageSize ?? 20} min={5} max={200} step={1} onChange={e => setField("pageSize", Number(e.target.value))} />
                          <span className="text-gray-500 text-xs mt-1">Standard: 20. Anzahl der Zeilen pro Seite in Tabellenansichten.</span>
                        </div>
                        <div className="flex flex-col gap-2 md:col-span-2">
                          <Label>Erlaubte Intervalle (Komma-getrennt)</Label>
                          <Input type="text" value={(settingsConfig.allowedIntervals || ["24h", "7d"]).join(", ")} onChange={e => setField("allowedIntervals", e.target.value.split(",").map((s: string) => s.trim()))} />
                          <span className="text-gray-500 text-xs mt-1">Beispiel: 24h, 7d. Diese Intervalle stehen im Dashboard zur Auswahl.</span>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                  <Card className="max-w-6xl mx-auto w-full p-8 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
                    <CardHeader><CardTitle>Chart-Farben</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-gray-500 text-xs mb-6">Passe die Farben der Diagramme an dein Branding an. Erlaubt sind Hex- oder CSS-Farbnamen (z.B. #06b6d4, red, rgb(255,0,0)).</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {Object.entries(settingsConfig.chartColors || {}).filter(([k]) => k !== 'gradients').map(([key, value]) => (
                          <div key={key} className="flex flex-col gap-2">
                            <Label>Farbe für {key}</Label>
                            <Input type="text" value={value as string} onChange={e => setField("chartColors", { ...settingsConfig.chartColors, [key]: e.target.value })} />
                            <span className="text-gray-500 text-xs mt-1">Aktuelle Farbe: {typeof value === 'string' ? value : JSON.stringify(value)}</span>
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
      {/* Import läuft Banner */}
      {importRunning && (
        <div className="w-full bg-yellow-200 text-yellow-900 text-center py-2 font-semibold shadow-md z-50">
          <span className="animate-pulse">CSV-Import läuft – bitte warten, keine weiteren Aktionen durchführen!</span>
        </div>
      )}
    </div>
  )
} 