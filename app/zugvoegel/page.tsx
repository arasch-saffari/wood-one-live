"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, Wind, Table as TableIcon, AlertTriangle, Speaker, MapPin, Music, Volume2, Thermometer, Droplets, Calendar, Clock, Info, Download } from "lucide-react"
import { TooltipProvider } from '@/components/ui/tooltip'
import { useStationData } from "@/hooks/useStationData"
import { useConfig } from "@/hooks/useConfig"
import { ChartPlayground } from '@/components/ChartPlayground'
import { useWeatherData } from '@/hooks/useWeatherData'
import { STATION_META } from '@/lib/stationMeta'
import { cn } from '@/lib/utils'
import { DataTable, DataTableColumn } from "@/components/DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useMemo } from "react"
import { useCallback } from "react"

function windDirectionText(dir: number | string | null | undefined): string {
  if (dir === null || dir === undefined) return '–';
  const deg = typeof dir === 'string' ? parseFloat(dir) : dir;
  if (isNaN(deg)) {
    const map: Record<string, string> = {
      n: 'Norden', nne: 'Nordnordost', ne: 'Nordost', ene: 'Ostnordost',
      e: 'Osten', ese: 'Ostsüdost', se: 'Südost', sse: 'Südsüdost',
      s: 'Süden', ssw: 'Südsüdwest', sw: 'Südwest', wsw: 'Westsüdwest',
      w: 'Westen', wnw: 'Westnordwest', nw: 'Nordwest', nnw: 'Nordnordwest'
    };
    const key = typeof dir === 'string' ? dir.toLowerCase() : '';
    return map[key] || dir.toString();
  }
  const directions = [
    'Norden', 'Nordnordost', 'Nordost', 'Ostnordost',
    'Osten', 'Ostsüdost', 'Südost', 'Südsüdost',
    'Süden', 'Südsüdwest', 'Südwest', 'Westsüdwest',
    'Westen', 'Westnordwest', 'Nordwest', 'Nordnordwest', 'Norden'
  ];
  const idx = Math.round(((deg % 360) / 22.5));
  return directions[idx];
}

// Typ für Tabellendaten
type TableRowType = {
  datetime?: string;
  time?: string;
  las?: number;
  ws?: number;
  wd?: number | string;
  rh?: number;
  station: string;
}

export default function ZugvoegelDashboard() {
  const { config } = useConfig();
  const ortDataObj = useStationData("ort", "24h", 60000);
  const technoDataObj = useStationData("techno", "24h", 60000);
  const bandDataObj = useStationData("band", "24h", 60000);
  const ortData = ortDataObj.data ?? []
  const technoData = technoDataObj.data ?? []
  const bandData = bandDataObj.data ?? []
  const { weather: latestWeather } = useWeatherData("global", "now", 60000)
  const [weatherLastUpdate, setWeatherLastUpdate] = useState<{ time: string|null } | null>(null)
  useEffect(() => {
    fetch('/api/weather/last-update')
      .then(res => res.json())
      .then(data => setWeatherLastUpdate(data))
      .catch(() => setWeatherLastUpdate(null))
  }, [])

  // Tabellenansicht vorbereiten (alle weiteren Hooks und States)
  const chartTimes = Array.from(new Set([
    ...ortData.map(d => d.time),
    ...bandData.map(d => d.time),
    ...technoData.map(d => d.time),
  ])).sort();
  const chartData = chartTimes.map(time => {
    const ort = ortData.find((d) => d.time === time)
    const techno = technoData.find((d) => d.time === time)
    const band = bandData.find((d) => d.time === time)
    const windVals = [ort, techno, band].map(d => d?.ws).filter((v): v is number => typeof v === 'number')
    const windSpeed = windVals.length > 0 ? (windVals.reduce((a, b) => a + b, 0) / windVals.length) : undefined
    return {
      time,
      ort: ort?.las ?? null,
      techno: techno?.las ?? null,
      band: band?.las ?? null,
      windSpeed: windSpeed ?? null,
    }
  })

  const currentLevels = {
    ort: ortData.length > 0 ? ortData[ortData.length - 1].las : 0,
    techno: technoData.length > 0 ? technoData[technoData.length - 1].las : 0,
    band: bandData.length > 0 ? bandData[bandData.length - 1].las : 0,
  }

  const WIND_COLOR = config?.chartColors?.wind || "#06b6d4"

  const tableRows: TableRowType[] = [
    ...ortData.map(row => ({ ...row, station: "Ort" })),
    ...technoData.map(row => ({ ...row, station: "Techno Floor" })),
    ...bandData.map(row => ({ ...row, station: "Band Bühne" })),
  ]
  const [showWeather, setShowWeather] = useState(false)
  const tableColumns: DataTableColumn<TableRowType>[] = [
    { label: "Datum", key: "datetime", sortable: true, render: (row: TableRowType) => {
      if (!row.datetime) return "-"
      // Wenn schon ein deutsches Datum (z.B. 22.07.2025), gib es direkt aus
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(row.datetime)) return row.datetime
      // Sonst wie bisher formatieren
      const d = new Date(row.datetime)
      return isNaN(d.getTime()) ? row.datetime : d.toLocaleDateString('de-DE')
    } },
    { label: "Zeit", key: "time", sortable: true },
    { label: "dB", key: "las", sortable: true, render: (row: TableRowType) => row.las !== undefined ? row.las.toFixed(1) : "-" },
    ...(showWeather ? [
      { label: "Wind", key: "ws", sortable: true, render: (row: TableRowType) => (row.ws !== undefined && row.ws !== null) ? row.ws.toFixed(1) : "-" },
      { label: "Richtung", key: "wd", render: (row: TableRowType) => (row.wd !== undefined && row.wd !== null && row.wd !== '') ? windDirectionText(row.wd) : "-" },
      { label: "Luftfeuchte", key: "rh", render: (row: TableRowType) => (row.rh !== undefined && row.rh !== null) ? row.rh.toFixed(0) + '%' : "-" },
    ] : []),
    { label: "Ort", key: "station", sortable: true },
  ]

  const [search, setSearch] = useState("")
  const [filterStation, setFilterStation] = useState("")
  const [filterDate, setFilterDate] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [filter15min, setFilter15min] = useState(false)
  const filteredRows = useMemo(() => {
    let rows = tableRows.filter((row: TableRowType) => {
      if (filterStation && row.station !== filterStation) return false
      if (filterDate && row.datetime && new Date(row.datetime).toLocaleDateString('de-DE') !== filterDate) return false
      if (search) {
        const s = search.toLowerCase()
        return Object.values(row).some(val => (val ? String(val).toLowerCase().includes(s) : false))
      }
      return true
    })
    if (filter15min) {
      // Aggregiere nach Datum, Stunde, 15-Minuten-Block und Station
      const grouped: Record<string, TableRowType[]> = {}
      for (const row of rows) {
        if (!row.time || !row.datetime) continue
        // Zeit robust parsen: HH:MM oder HH:MM:SS
        const [h, m] = row.time.split(':')
        if (!h || !m) continue
        const hour = h.padStart(2, '0')
        const minBlock = String(Math.floor(Number(m) / 15) * 15).padStart(2, '0')
        const date = new Date(row.datetime)
        const dateStr = date.toLocaleDateString('de-DE')
        const key = `${row.station}|${dateStr}|${hour}:${minBlock}`
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(row)
      }
      rows = Object.entries(grouped).map(([key, group]) => {
        const [station, _date, time] = key.split('|')
        // Mittelwerte berechnen
        const avg = (arr: (number|undefined)[]) => {
          const nums = arr.filter((v): v is number => typeof v === 'number')
          return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined
        }
        // Datum korrekt extrahieren
        let dateStr = '-';
        if (group[0].datetime) {
          const d = new Date(group[0].datetime)
          if (!isNaN(d.getTime())) {
            dateStr = d.toLocaleDateString('de-DE')
          }
        }
        return {
          datetime: dateStr,
          time,
          las: avg(group.map(r => r.las)),
          ws: avg(group.map(r => r.ws)),
          wd: group[group.length-1].wd,
          rh: avg(group.map(r => r.rh)),
          station,
        }
      }).sort((a, b) => {
        // Sortiere nach Datum, Zeit, Station
        const dA = a.datetime || ''
        const dB = b.datetime || ''
        if (dA !== dB) return dA.localeCompare(dB)
        if (a.time !== b.time) return (a.time || '').localeCompare(b.time || '')
        return (a.station || '').localeCompare(b.station || '')
      })
    }
    return rows
  }, [tableRows, filterStation, filterDate, search, filter15min])

  // Pagination-Reset bei Filter/Suche
  useEffect(() => { setPage(1) }, [filterStation, filterDate, search])

  const pageCount = Math.ceil(filteredRows.length / pageSize)
  const pagedRows = useMemo(() => filteredRows.slice((page-1)*pageSize, page*pageSize), [filteredRows, page, pageSize])

  function exportCSV() {
    const header = tableColumns.map(c => c.label).join(';')
    const rows = filteredRows.map((row: TableRowType) => tableColumns.map(c => {
      const val = c.render ? c.render(row) : row[c.key as keyof TableRowType]
      return typeof val === 'string' ? val.replace(/;/g, ',') : val
    }).join(';'))
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'zugvoegel-tabelle.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  function exportJSON() {
    const json = JSON.stringify(filteredRows, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'zugvoegel-tabelle.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const allStations = useMemo(() => Array.from(new Set(tableRows.map(r => r.station))), [tableRows])
  const allDates = useMemo(() => Array.from(new Set(tableRows.map(r => r.datetime ? new Date(r.datetime).toLocaleDateString('de-DE') : "-"))).filter(d => d !== "-"), [tableRows])

  // Icon-Mapping für Stationen
  const STATION_ICONS: Record<string, JSX.Element> = {
    "Ort": <MapPin className="w-6 h-6 text-emerald-500" />, 
    "Techno Floor": <Volume2 className="w-6 h-6 text-pink-500" />, 
    "Band Bühne": <Music className="w-6 h-6 text-purple-500" />
  }

  if (!config) return <div className="flex items-center justify-center min-h-[300px] text-gray-400 text-sm">Lade Konfiguration ...</div>;

  // Kompakte Pagination-Komponente
  function CompactPagination({ page, pageCount, setPage }: { page: number; pageCount: number; setPage: (p: number) => void }) {
    if (pageCount <= 1) return null;
    const pages: (number | 'ellipsis')[] = [];
    if (pageCount <= 7) {
      for (let i = 1; i <= pageCount; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 4) pages.push('ellipsis');
      for (let i = Math.max(2, page - 1); i <= Math.min(pageCount - 1, page + 1); i++) {
        if (i !== 1 && i !== pageCount) pages.push(i);
      }
      if (page < pageCount - 3) pages.push('ellipsis');
      pages.push(pageCount);
    }
    return (
      <div className="flex items-center justify-center gap-1 mt-4">
        <button
          className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs disabled:opacity-50"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Zurück
        </button>
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400">…</span>
          ) : (
            <button
              key={`page-${p}`}
              className={`px-2 py-1 rounded text-xs ${p === page ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
              onClick={() => setPage(Number(p))}
              disabled={p === page}
            >
              {p}
            </button>
          )
        )}
        <button
          className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs disabled:opacity-50"
          disabled={page === pageCount}
          onClick={() => setPage(page + 1)}
        >
          Weiter
        </button>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto w-full space-y-10">
        {/* Header */}
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-purple-700 to-pink-600 p-5 shadow-2xl border border-violet-300 dark:border-violet-900">
              <Speaker className="w-10 h-10 text-white drop-shadow-lg" />
            </div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-violet-700 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent tracking-tight drop-shadow-lg text-center">Wood One Audio</h1>
            <div className="text-lg text-gray-700 dark:text-gray-200 font-semibold mt-1 text-center">Live Monitoring Dashboard</div>
          </div>
        </div>
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          {Object.entries(currentLevels).map(([location, level]) => {
            const meta = STATION_META[location as keyof typeof STATION_META]
            return (
              <Card key={location} className="rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 hover:scale-[1.025] transition-transform">
                <CardHeader className="flex flex-row items-center gap-4 p-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 shadow">
                    {STATION_ICONS[meta.name]}
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{meta.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">aktuell</span>
                  </div>
                  <Badge className={cn("rounded-lg px-3 py-1 text-base font-semibold", meta.kpiColor)}>{level.toFixed(1)} dB</Badge>
                </CardHeader>
              </Card>
            )})}
        </div>
        {/* Wetter Card */}
        <Card className="mb-10 rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800">
          <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
            <div className="flex items-center gap-2">
              <Wind className="w-6 h-6 text-cyan-500" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">Wetter</span>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="w-4 h-4 mr-1" />
              {weatherLastUpdate?.time ?? '-'}
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-6">
            {latestWeather ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="flex items-center justify-center gap-2 mb-2"><Wind className="w-5 h-5 text-cyan-500" /><span className="text-xs">Wind</span></div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{latestWeather.windSpeed ?? '-'}<span className="text-base font-normal"> km/h</span></div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 mb-2"><Droplets className="w-5 h-5 text-blue-400" /><span className="text-xs">Luftfeuchte</span></div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{latestWeather.relHumidity ?? '-'}<span className="text-base font-normal">%</span></div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 mb-2"><Thermometer className="w-5 h-5 text-orange-400" /><span className="text-xs">Temperatur</span></div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{typeof latestWeather.temperature === 'number' ? Math.round(latestWeather.temperature) : '-'}<span className="text-base font-normal">°C</span></div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 mb-2"><Info className="w-5 h-5 text-purple-400" /><span className="text-xs">Richtung</span></div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{windDirectionText(latestWeather.windDir)}</div>
                </div>
              </div>
            ) : <div className="text-gray-400 text-center py-6">Keine Wetterdaten verfügbar</div>}
          </CardContent>
        </Card>
        {/* Chart */}
        <Card className="mb-10 rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800">
          <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
            <BarChart3 className="w-6 h-6 text-blue-500" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">Verlauf</span>
          </CardHeader>
          <CardContent className="pt-0 pb-6">
            <ChartPlayground
              data={chartData}
              lines={[
                { key: 'ort', label: STATION_META.ort.name, color: STATION_META.ort.chartColor },
                { key: 'techno', label: STATION_META.techno.name, color: STATION_META.techno.chartColor },
                { key: 'band', label: STATION_META.band.name, color: STATION_META.band.chartColor },
                { key: 'windSpeed', label: 'Windgeschwindigkeit', color: WIND_COLOR, yAxisId: 'wind', strokeDasharray: '5 5' },
              ]}
              axes={[
                { id: 'left', orientation: 'left', domain: [30, 85], label: 'dB' },
                { id: 'wind', orientation: 'right', domain: [0, 25], label: 'km/h' },
              ]}
              title="Zugvögel Chart"
              icon={<BarChart3 className="w-6 h-6 text-blue-500" />}
            />
          </CardContent>
        </Card>
        {/* Tabellenansicht */}
        <Card className="mb-10 rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800">
          <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
            <TableIcon className="w-6 h-6 text-violet-500" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">Tabellenansicht</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={exportCSV} className="flex items-center gap-1"><Download className="w-4 h-4" /> CSV</Button>
              <Button size="sm" variant="outline" onClick={exportJSON} className="flex items-center gap-1"><Download className="w-4 h-4" /> JSON</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-6">
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <Input placeholder="Suche..." value={search} onChange={e => setSearch(e.target.value)} className="w-40" />
              <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border rounded px-2 py-1">
                <option value="">Alle Daten</option>
                {allDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filterStation} onChange={e => setFilterStation(e.target.value)} className="border rounded px-2 py-1">
                <option value="">Alle Orte</option>
                {allStations.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
              <label className="flex items-center gap-1 ml-4 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={showWeather} onChange={e => setShowWeather(e.target.checked)} className="accent-blue-500" />
                Wetterspalten anzeigen
              </label>
              <select value={filter15min ? '15' : ''} onChange={e => setFilter15min(e.target.value === '15')} className="border rounded px-2 py-1 ml-4">
                <option value="">Alle Zeitpunkte</option>
                <option value="15">Nur 15-Minuten-Werte</option>
              </select>
            </div>
            <div className="w-full overflow-x-auto max-w-full">
              <table className="min-w-full text-xs border-separate border-spacing-y-2">
                <thead className="bg-gray-100 dark:bg-gray-900/40">
                  <tr>
                    {tableColumns.map(col => (
                      <th key={col.key} className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 text-sm text-left align-middle">
                        <span className="flex items-center gap-1">
                          {col.key === 'datetime' && <Calendar className="w-4 h-4 text-blue-400" />}
                          {col.key === 'ws' && <Wind className="w-4 h-4 text-cyan-500" />}
                          {col.key === 'wd' && <Info className="w-4 h-4 text-purple-400" />}
                          {col.key === 'rh' && <Droplets className="w-4 h-4 text-blue-400" />}
                          {col.key === 'station' && <MapPin className="w-4 h-4 text-emerald-500" />}
                          {col.key === 'las' && <Volume2 className="w-4 h-4 text-pink-500" />}
                          {col.key === 'time' && <Clock className="w-4 h-4 text-gray-400" />}
                          {col.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.length === 0 ? (
                    <tr><td colSpan={tableColumns.length} className="text-gray-400 text-center py-4">Keine Daten</td></tr>
                  ) : pagedRows.map((row: TableRowType, i: number) => (
                    <tr key={i} className="bg-white/70 dark:bg-gray-900/40 hover:bg-blue-50/60 dark:hover:bg-blue-900/20 transition rounded-xl shadow-sm">
                      {tableColumns.map(col => (
                        <td key={col.key} className="px-3 py-2 align-middle">
                          {col.render ? col.render(row) : row[col.key as keyof TableRowType]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <CompactPagination page={page} pageCount={pageCount} setPage={setPage} />
            </div>
          </CardContent>
        </Card>
        {/* Grenzwert-Referenz */}
        <Card className="mb-10 rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800">
          <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">Grenzwert-Referenz</span>
          </CardHeader>
          <CardContent className="pt-0 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {config && Object.entries(config.thresholdsByStationAndTime).filter(([station]) => ["ort","techno","band"].includes(station)).map(([station, blocks]) => (
                <Card key={station} className="rounded-xl bg-white/90 dark:bg-gray-900/70 border-0 shadow-md p-4">
                  <CardHeader className="pb-2 flex flex-row items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400" />
                    <CardTitle className="text-base font-semibold text-gray-700 dark:text-gray-300">
                      {station.charAt(0).toUpperCase() + station.slice(1)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {(blocks as any[]).map((block: any, i: number) => (
                      <div key={i} className="flex flex-col gap-1 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/40 mb-2 last:mb-0">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                          <Calendar className="w-3 h-3 text-blue-400" />
                          {block.from} - {block.to}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-yellow-400/20 text-yellow-600 border-yellow-400/30 px-2 py-0.5 rounded-md flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Warnung: ≥ {block.warning} dB</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-red-400/20 text-red-600 border-red-400/30 px-2 py-0.5 rounded-md flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Alarm: ≥ {block.alarm} dB</Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </TooltipProvider>
  )
} 