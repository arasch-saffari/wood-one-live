"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, Wind, Table as TableIcon, AlertTriangle, Speaker, MapPin, Music, Volume2, Thermometer, Droplets, Calendar, Clock, Info, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useStationData } from "@/hooks/useStationData"
import { useConfig } from "@/hooks/useConfig"
import { ChartPlayground } from '@/components/ChartPlayground'
import { useWeatherData } from '@/hooks/useWeatherData'
import { STATION_META } from '@/lib/stationMeta'
import { cn } from '@/lib/utils'
import { DataTableColumn } from "@/components/DataTable"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination"
import { Input } from "@/components/ui/input"
import { useMemo } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { GlobalLoader } from "@/components/GlobalLoader"

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
  // ALLE HOOKS GANZ OBEN!
  const [showLoader, setShowLoader] = useState(true)
  const { config } = useConfig();
  const ortDataObj = useStationData("ort", "24h", 60000);
  const technoDataObj = useStationData("techno", "24h", 60000);
  const bandDataObj = useStationData("band", "24h", 60000);
  const ortData = ortDataObj.data ?? []
  const technoData = technoDataObj.data ?? []
  const bandData = bandDataObj.data ?? []
  const { weather: latestWeather } = useWeatherData("global", "now", 60000)
  const [weatherLastUpdate, setWeatherLastUpdate] = useState<{ time: string|null } | null>(null)
  const [showWeather, setShowWeather] = useState(false)
  const [search, setSearch] = useState("")
  const [filterStation, setFilterStation] = useState("")
  const [filterDate, setFilterDate] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [filter15min, setFilter15min] = useState(false)
  // (bereits oben deklariert)
  useEffect(() => {
    fetch('/api/weather/last-update')
      .then(res => res.json())
      .then(data => setWeatherLastUpdate(data))
      .catch(() => setWeatherLastUpdate(null))
  }, [])
  // Ladefortschritt berechnen
  const loadingStates = [!config, ortDataObj.loading, technoDataObj.loading, bandDataObj.loading]
  const progress = 25 + loadingStates.filter(Boolean).length * 18
  useEffect(() => {
    if (config && !ortDataObj.loading && !technoDataObj.loading && !bandDataObj.loading) {
      const t = setTimeout(() => setShowLoader(false), 350)
      return () => clearTimeout(t)
    }
  }, [config, ortDataObj.loading, technoDataObj.loading, bandDataObj.loading])
  const tableRows: TableRowType[] = [
    ...ortData.map(row => ({ ...row, station: "Ort" })),
    ...technoData.map(row => ({ ...row, station: "Techno Floor" })),
    ...bandData.map(row => ({ ...row, station: "Band Bühne" })),
  ]
  const tableColumns: DataTableColumn<TableRowType>[] = [
    { label: "Datum", key: "datetime", sortable: true, render: (row: TableRowType) => {
      if (!row.datetime) return "-"
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(row.datetime)) return row.datetime
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
  // Sortier-Logik
  const [sortKey, setSortKey] = useState<string>('datetime')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'datetime' ? 'desc' : 'asc') // Standard: Datum absteigend, sonst aufsteigend
    }
  }

  function getSortIcon(key: string) {
    const isActive = sortKey === key
    return (
      <span className={
        'ml-auto flex items-center justify-end w-5 h-5 transition-transform ' +
        (isActive ? (sortDir === 'asc' ? 'rotate-180 text-blue-600 dark:text-blue-400' : 'text-blue-600 dark:text-blue-400') : 'text-gray-300 dark:text-gray-700')
      }>
        <ChevronDown className="w-4 h-4" />
      </span>
    )
  }

  // Alarm-Filter
  const [showOnlyAlarms, setShowOnlyAlarms] = useState(false)

  const filteredRows = useMemo(() => {
    let rows = tableRows.filter((row: TableRowType) => {
      if (filterStation && row.station !== filterStation) return false
      if (filterDate && row.datetime && new Date(row.datetime).toLocaleDateString('de-DE') !== filterDate) return false
      if (search) {
        const s = search.toLowerCase()
        return Object.values(row).some(val => (val ? String(val).toLowerCase().includes(s) : false))
      }
      if (showOnlyAlarms && config?.thresholdsByStationAndTime) {
        // Hole Alarm-Grenzwert für die Station (immer ersten Block nehmen)
        const stationKey = (row.station || '').toLowerCase().replace(/ /g, '')
        const blocks = config.thresholdsByStationAndTime[stationKey]
        if (!blocks || !blocks[0] || typeof blocks[0].alarm !== 'number') return false
        if (typeof row.las !== 'number') return false
        return row.las >= blocks[0].alarm
      }
      return true
    })
    // Sortierung anwenden
    rows = [...rows].sort((a, b) => {
      const aVal = a[sortKey as keyof TableRowType]
      const bVal = b[sortKey as keyof TableRowType]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (sortKey === 'datetime') {
        const aDate = new Date(aVal as string)
        const bDate = new Date(bVal as string)
        return sortDir === 'asc' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime()
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
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
        const [station, , time] = key.split('|')
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
  }, [tableRows, filterStation, filterDate, search, filter15min, sortKey, sortDir, showOnlyAlarms, config?.thresholdsByStationAndTime])
  const pageCount = Math.ceil(filteredRows.length / pageSize)
  const pagedRows = useMemo<TableRowType[]>(() => filteredRows.slice((page-1)*pageSize, page*pageSize), [filteredRows, page, pageSize])
  const allStations = useMemo(() => Array.from(new Set(tableRows.map(r => r.station))), [tableRows])
  const allDates = useMemo(() => {
    const dateSet = new Set(tableRows.map(r => r.datetime ? new Date(r.datetime).toLocaleDateString('de-DE') : "-"));
    return Array.from(dateSet).filter((d): d is string => d !== "-");
  }, [tableRows])

  // Loader nur im JSX-Return bedingt anzeigen
  if (showLoader) {
    return (
      <GlobalLoader 
        text="Dashboard wird geladen ..." 
        progress={progress}
        icon={<Speaker className="w-10 h-10 text-white drop-shadow-lg" />}
      />
    )
  }

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

  // Export-Funktionen entfernt (Export-Button entfällt)

  // Icon-Mapping für Stationen
  const STATION_ICONS: Record<string, JSX.Element> = {
    "Ort": <MapPin className="w-6 h-6 text-emerald-500" />, 
    "Techno Floor": <Volume2 className="w-6 h-6 text-pink-500" />, 
    "Band Bühne": <Music className="w-6 h-6 text-purple-500" />
  }

  if (!config) return <div className="flex items-center justify-center min-h-[300px] text-gray-400 text-sm">Lade Konfiguration ...</div>;

  // Kompakte Pagination-Komponente wurde entfernt (ersetzt durch shadcn Pagination)

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4 md:p-8 pb-8 pt-4">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-8 md:mb-10 gap-y-4">
          {Object.entries(currentLevels).map(([location, level]) => {
            const meta = STATION_META[location as keyof typeof STATION_META]
            return (
              <Card key={location} className="rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 hover:scale-[1.025] transition-transform">
                <CardHeader className="flex flex-row items-center gap-4 md:gap-6 p-3 md:p-8">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 shadow">
                        {STATION_ICONS[meta.name]}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{meta.name} (aktuell)</TooltipContent>
                  </Tooltip>
                  <div className="flex flex-col flex-1 items-center justify-center">
                    <span className="text-base md:text-lg font-bold text-gray-900 dark:text-white">{meta.name}</span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className={cn("rounded-lg px-3 md:px-4 py-1.5 md:py-2 text-base md:text-lg font-semibold cursor-pointer", meta.kpiColor)}>{level.toFixed(1)} dB</Badge>
                    </TooltipTrigger>
                    <TooltipContent>Lautstärke (dB)</TooltipContent>
                  </Tooltip>
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
        <div className="mb-10 w-full">
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
            title=""
            icon={null}
          />
        </div>
        {/* Tabellenansicht */}
        <Card className="mb-10 rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800">
          <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
            <TableIcon className="w-6 h-6 text-violet-500" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">Tabellenansicht</span>
            {/* Export-Buttons entfernt */}
          </CardHeader>
          <CardContent className="pt-0 pb-6">
            <div className="flex flex-col md:flex-row flex-wrap gap-2 md:gap-3 mb-4 md:mb-6 items-end w-full sticky top-0 z-20 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900/80 backdrop-blur-md pt-4 pb-4 px-2 md:px-4 rounded-2xl shadow-sm">
              <div className="flex flex-col w-full md:w-44">
                <Label htmlFor="search" className="text-xs mb-1">Suche</Label>
                <Input id="search" placeholder="Suche..." value={search} onChange={e => setSearch(e.target.value)} className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-400 transition" />
              </div>
              <div className="w-full md:w-[150px]">
                <Select value={filterDate || 'all'} onValueChange={v => setFilterDate(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-400 transition">
                    <span>{filterDate ? filterDate : 'Datum'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Daten</SelectItem>
                    {allDates.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-[150px]">
                <Select value={filterStation || 'all'} onValueChange={v => setFilterStation(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-400 transition">
                    <span>{filterStation ? filterStation : 'Ort'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Orte</SelectItem>
                    {allStations.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-[170px]">
                <Select value={filter15min ? '15' : 'all'} onValueChange={v => setFilter15min(v === '15')}>
                  <SelectTrigger className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-400 transition">
                    <span>{filter15min ? 'Nur 15-Minuten-Werte' : 'Werte'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Zeitpunkte</SelectItem>
                    <SelectItem value="15">Nur 15-Minuten-Werte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1" />
              <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto min-w-[320px] h-10 mt-2 md:mt-0">
                <div className="flex items-center gap-2 flex-1 px-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <Wind className="w-5 h-5 text-cyan-700 dark:text-cyan-300" />
                        <Label htmlFor="showWeather" className="text-xs font-medium">Wetterspalten</Label>
                        <Switch id="showWeather" checked={showWeather} onCheckedChange={setShowWeather} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Wetterspalten anzeigen</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2 flex-1 px-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={"w-5 h-5 " + (showOnlyAlarms ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-600")} />
                        <Label htmlFor="showOnlyAlarms" className="text-xs font-medium">Nur Alarme</Label>
                        <Switch id="showOnlyAlarms" checked={showOnlyAlarms} onCheckedChange={setShowOnlyAlarms} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Nur Einträge mit Alarm anzeigen</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
            <div className="w-full overflow-x-auto max-w-full pb-2 min-w-[320px]">
              <table className="min-w-full text-xs md:text-sm border-separate border-spacing-y-2 rounded-xl overflow-hidden">
                <thead className="bg-gray-100 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
                  <tr>
                    {tableColumns.map(col => (
                      <th
                        key={col.key}
                        className="px-3 py-3 font-bold text-gray-700 dark:text-gray-100 text-xs md:text-sm uppercase tracking-wide text-left align-middle cursor-pointer select-none hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition relative group"
                        onClick={() => handleSort(col.key)}
                        scope="col"
                      >
                        <div className="flex items-center gap-1 w-full">
                          <span className="flex items-center gap-1">
                            {col.key === 'datetime' && <Tooltip><TooltipTrigger asChild><Calendar className="w-4 h-4 text-blue-400" /></TooltipTrigger><TooltipContent>Datum</TooltipContent></Tooltip>}
                            {col.key === 'ws' && <Tooltip><TooltipTrigger asChild><Wind className="w-4 h-4 text-cyan-500" /></TooltipTrigger><TooltipContent>Wind</TooltipContent></Tooltip>}
                            {col.key === 'wd' && <Tooltip><TooltipTrigger asChild><Info className="w-4 h-4 text-purple-400" /></TooltipTrigger><TooltipContent>Windrichtung</TooltipContent></Tooltip>}
                            {col.key === 'rh' && <Tooltip><TooltipTrigger asChild><Droplets className="w-4 h-4 text-blue-400" /></TooltipTrigger><TooltipContent>Luftfeuchte</TooltipContent></Tooltip>}
                            {col.key === 'station' && <Tooltip><TooltipTrigger asChild><MapPin className="w-4 h-4 text-emerald-500" /></TooltipTrigger><TooltipContent>Ort</TooltipContent></Tooltip>}
                            {col.key === 'las' && <Tooltip><TooltipTrigger asChild><Volume2 className="w-4 h-4 text-pink-500" /></TooltipTrigger><TooltipContent>dB</TooltipContent></Tooltip>}
                            {col.key === 'time' && <Tooltip><TooltipTrigger asChild><Clock className="w-4 h-4 text-gray-400" /></TooltipTrigger><TooltipContent>Zeit</TooltipContent></Tooltip>}
                          </span>
                          {getSortIcon(col.key)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.length === 0 ? (
                    <tr><td colSpan={tableColumns.length} className="text-gray-400 text-center py-4">Keine Daten</td></tr>
                  ) : pagedRows.map((row: TableRowType, i: number) => (
                    <tr key={i} className={
                      `transition rounded-xl shadow-sm ` +
                      (i % 2 === 0 ? 'bg-white/90 dark:bg-gray-900/40' : 'bg-gray-50 dark:bg-gray-800/40') +
                      ' hover:bg-blue-50/60 dark:hover:bg-blue-900/20'
                    }>
                      {tableColumns.map((col: DataTableColumn<TableRowType>) => (
                        <td key={col.key} className={
                          `py-2 align-middle whitespace-nowrap ` +
                          (col.key === 'wd' || col.key === 'rh' ? 'hidden xs:table-cell' : '') +
                          ' px-1 md:px-3'
                        }>
                          {col.render ? col.render(row) : row[col.key as keyof TableRowType]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination className="mt-4 select-none min-w-[180px]">
                <PaginationContent>
                  <PaginationItem>
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      className="h-8 w-8 md:h-9 md:w-9 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition disabled:opacity-50"
                      disabled={page === 1}
                      aria-label="Vorherige Seite"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  </PaginationItem>
                  {/* Seitenzahlen mit Ellipsen */}
                  {(() => {
                    const items = [];
                    const maxPages = pageCount;
                    const delta = 1; // wie viele Nachbarseiten links/rechts
                    const range = [];
                    for (let i = Math.max(2, page - delta); i <= Math.min(maxPages - 1, page + delta); i++) {
                      range.push(i);
                    }
                    if (maxPages <= 7) {
                      for (let i = 1; i <= maxPages; i++) {
                        items.push(
                          <PaginationItem key={i}>
                            <PaginationLink isActive={i === page} onClick={() => setPage(i)} className="h-8 w-8 md:h-9 md:w-9 rounded-lg text-base font-semibold" >{i}</PaginationLink>
                          </PaginationItem>
                        );
                      }
                    } else {
                      // Erste Seite
                      items.push(
                        <PaginationItem key={1}>
                          <PaginationLink isActive={page === 1} onClick={() => setPage(1)}>1</PaginationLink>
                        </PaginationItem>
                      );
                      // Ellipse vor Range
                      if (page - delta > 2) {
                        items.push(<PaginationItem key="start-ellipsis"><span className="px-2 text-lg">…</span></PaginationItem>);
                      }
                      // Range
                      range.forEach(i => {
                        items.push(
                          <PaginationItem key={i}>
                            <PaginationLink isActive={i === page} onClick={() => setPage(i)} className="h-8 w-8 md:h-9 md:w-9 rounded-lg text-base font-semibold">{i}</PaginationLink>
                          </PaginationItem>
                        );
                      });
                      // Ellipse nach Range
                      if (page + delta < maxPages - 1) {
                        items.push(<PaginationItem key="end-ellipsis"><span className="px-2 text-lg">…</span></PaginationItem>);
                      }
                      // Letzte Seite
                      if (maxPages > 1) {
                        items.push(
                          <PaginationItem key={maxPages}>
                            <PaginationLink isActive={page === maxPages} onClick={() => setPage(maxPages)} className="h-8 w-8 md:h-9 md:w-9 rounded-lg text-base font-semibold">{maxPages}</PaginationLink>
                          </PaginationItem>
                        );
                      }
                    }
                    return items;
                  })()}
                  <PaginationItem>
                    <button
                      onClick={() => setPage(Math.min(pageCount, page + 1))}
                      className="h-8 w-8 md:h-9 md:w-9 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition disabled:opacity-50"
                      disabled={page === pageCount}
                      aria-label="Nächste Seite"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
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
              {config && Object.entries(config.thresholdsByStationAndTime).filter(([station]) => ["ort","techno","band"].includes(station)).map(([station, blocks]) => {
                let showBlocks: Array<any> = blocks as any[];
                if (station === "ort" && Array.isArray(blocks) && blocks.length > 2) {
                  showBlocks = blocks.slice(0, 2);
                }
                return (
                  <Card key={station} className="rounded-xl bg-white/90 dark:bg-gray-900/70 border-0 shadow-md p-4">
                    <CardHeader className="pb-2 flex flex-col items-center gap-2 text-center">
                      <CardTitle className="text-base font-semibold text-gray-700 dark:text-gray-300 w-full text-center">
                        {station.charAt(0).toUpperCase() + station.slice(1)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      {showBlocks.map((block: any, i: number) => (
                        <div
                          key={i}
                          className={
                            `flex flex-col gap-1 p-2 rounded-lg mb-2 last:mb-0 transition-all ` +
                            `hover:shadow-lg hover:ring-2 hover:ring-yellow-300/40 dark:hover:ring-yellow-500/30 `
                          }
                        >
                          <div className="flex items-center justify-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-1 text-center w-full">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span>{block.from} - {block.to}</span>
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <Badge className="bg-yellow-400/20 text-yellow-700 border-yellow-400/30 px-3 py-1 min-w-[170px] rounded-md flex items-center gap-1 text-base font-semibold transition-colors hover:bg-yellow-400/80 hover:text-yellow-900 hover:shadow-md justify-center">
                              <AlertTriangle className="w-4 h-4" /> Warnung: ≥ {block.warning} dB
                            </Badge>
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <Badge className="bg-red-400/20 text-red-700 border-red-400/30 px-3 py-1 min-w-[170px] rounded-md flex items-center gap-1 text-base font-semibold transition-colors hover:bg-red-400/80 hover:text-red-900 hover:shadow-md justify-center">
                              <AlertTriangle className="w-4 h-4" /> Alarm: ≥ {block.alarm} dB
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </TooltipProvider>
  )
} 