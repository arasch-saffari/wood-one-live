import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table as TableIcon, Wind, AlertTriangle, MapPin, Volume2, Droplets, Info, Calendar, Clock, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { DataTableColumn } from "@/components/DataTable"
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select"
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@/components/ui/pagination"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

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

type TableRowType = {
  datetime?: string;
  time?: string;
  las?: number;
  ws?: number;
  wd?: number | string;
  rh?: number;
  station: string;
}

type AllStationsTableProps = {
  ortData: TableRowType[];
  heuballernData: TableRowType[];
  technoData: TableRowType[];
  bandData: TableRowType[];
  config: Record<string, unknown>;
}

export function AllStationsTable({ ortData, heuballernData, technoData, bandData, config }: AllStationsTableProps) {
  const [showWeather, setShowWeather] = useState(false)
  const [search, setSearch] = useState("")
  const [filterStation, setFilterStation] = useState("")
  const [filterDate, setFilterDate] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [filter15min, setFilter15min] = useState(false)
  const [showOnlyAlarms, setShowOnlyAlarms] = useState(false)

  const tableRows: TableRowType[] = [
    ...ortData.map(row => ({ ...row, station: "Ort" })),
    ...technoData.map(row => ({ ...row, station: "Techno Floor" })),
    ...bandData.map(row => ({ ...row, station: "Band Bühne" })),
    ...heuballernData.map(row => ({ ...row, station: "Heuballern" })),
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
      setSortDir(key === 'datetime' ? 'desc' : 'asc')
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

  const filteredRows = useMemo(() => {
    let rows = tableRows.filter((row: TableRowType) => {
      if (filterStation && row.station !== filterStation) return false
      if (filterDate && row.datetime && new Date(row.datetime).toLocaleDateString('de-DE') !== filterDate) return false
      if (search) {
        const s = search.toLowerCase()
        return Object.values(row).some(val => (val ? String(val).toLowerCase().includes(s) : false))
      }
      if (showOnlyAlarms && config?.thresholdsByStationAndTime) {
        const blocks = config.thresholdsByStationAndTime as Array<{ alarm: number }>
        if (!blocks || !blocks[0] || typeof blocks[0].alarm !== 'number') return false
        if (typeof row.las !== 'number') return false
        return row.las >= blocks[0].alarm
      }
      return true
    })
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
      const grouped: Record<string, TableRowType[]> = {}
      for (const row of rows) {
        if (!row.time || !row.datetime) continue
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
        const avg = (arr: (number|undefined)[]) => {
          const nums = arr.filter((v): v is number => typeof v === 'number')
          return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined
        }
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

  return (
    <Card className="mb-10 rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800">
      <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
        <TableIcon className="w-6 h-6 text-violet-500" />
        <span className="text-xl font-bold text-gray-900 dark:text-white">Tabellenansicht</span>
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
                      {col.sortable && getSortIcon(col.key)}
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
                const delta = 1;
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
                  items.push(
                    <PaginationItem key={1}>
                      <PaginationLink isActive={page === 1} onClick={() => setPage(1)}>1</PaginationLink>
                    </PaginationItem>
                  );
                  if (page - delta > 2) {
                    items.push(<PaginationItem key="start-ellipsis"><span className="px-2 text-lg">…</span></PaginationItem>);
                  }
                  range.forEach(i => {
                    items.push(
                      <PaginationItem key={i}>
                        <PaginationLink isActive={i === page} onClick={() => setPage(i)} className="h-8 w-8 md:h-9 md:w-9 rounded-lg text-base font-semibold">{i}</PaginationLink>
                      </PaginationItem>
                    );
                  });
                  if (page + delta < maxPages - 1) {
                    items.push(<PaginationItem key="end-ellipsis"><span className="px-2 text-lg">…</span></PaginationItem>);
                  }
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
  )
} 