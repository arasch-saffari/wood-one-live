import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table as TableIcon, Wind, AlertTriangle, Info, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { Tooltip as UITooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { DataTableColumn } from "@/components/DataTable"
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select"
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@/components/ui/pagination"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ScrollArea } from '@/components/ui/scroll-area'
import { STATION_META } from "@/lib/stationMeta"
// Typen lokal definieren, statt aus page.tsx zu importieren
type StationKey = "ort" | "techno" | "band" | "heuballern";
type ThresholdBlock = {
  from: string;
  to: string;
  warning: number;
  alarm: number;
  las: number;
  laf: number;
};
type ConfigType = {
  warningThreshold: number;
  alarmThreshold: number;
  lasThreshold: number;
  lafThreshold: number;
  stations: StationKey[];
  enableNotifications: boolean;
  csvAutoProcess: boolean;
  backupRetentionDays: number;
  uiTheme: string;
  calculationMode: string;
  adminEmail: string;
  weatherApiKey: string;
  apiCacheDuration: number;
  pollingIntervalSeconds: number;
  chartLimit: number;
  pageSize: number;
  defaultInterval: string;
  defaultGranularity: string;
  allowedIntervals: string[];
  allowedGranularities: string[];
  chartColors: {
    primary: string;
    wind: string;
    humidity: string;
    temperature: string;
    warning: string;
    danger: string;
    alarm: string;
    reference: string;
    gradients: Record<string, { from: string; to: string }>;
  };
  thresholdsByStationAndTime: Record<StationKey, ThresholdBlock[]>;
  chartVisibleLines: Record<StationKey, string[]>;
};

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

export type TableRowType = {
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
  granularity?: string;
  page?: number;
  setPage?: (page: number) => void;
  pageSize?: number;
  totalCount?: number;
  alarmRows?: TableRowType[];
  showOnlyAlarms?: boolean;
  onAlarmToggle?: (val: boolean) => void;
  onTopRowChange?: (row: TableRowType | null) => void;
  filterStation?: string;
}

// Hilfsfunktion: robustes Datum-Parsing für verschiedene Formate
export function parseDate(dt: string | undefined): Date | null {
  if (!dt) return null;
  // Ersetze nur das Leerzeichen zwischen Datum und Zeit durch T
  let iso = dt.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, '$1T$2');
  // Hänge nur dann ein Z an, wenn keine Zeitzone vorhanden ist
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) iso = iso + 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    if (typeof window !== 'undefined') {
      console.warn('[parseDate] Ungültiges Datum:', dt, '→', iso);
    }
    return null;
  }
  return d;
}

// Hilfsfunktion: Hole den passenden Alarm-Schwellenwert für eine Tabellenzeile
export function getAlarmThresholdForRow(row: TableRowType, config: ConfigType): number | undefined {
  if (!config?.thresholdsByStationAndTime || !row.station || !row.time) return undefined;
  // Station-Key normalisieren
  let stationKey = typeof row.station === 'string' ? row.station.toLowerCase() : '';
  if (stationKey === "techno floor") stationKey = "techno";
  if (stationKey === "band bühne") stationKey = "band";
  // Zeit im Format HH:MM extrahieren
  const time = row.time.slice(0, 5);
  const blocks = config.thresholdsByStationAndTime[stationKey as StationKey];
  if (!blocks) return undefined;
  // Zeit als Minuten seit Mitternacht
  const [h, m] = time.split(":").map(Number);
  const minutes = h * 60 + m;
  for (const block of blocks) {
    const [fromH, fromM] = block.from.split(":").map(Number);
    const [toH, toM] = block.to.split(":").map(Number);
    const fromMin = fromH * 60 + fromM;
    const toMin = toH * 60 + toM;
    if (fromMin < toMin) {
      if (minutes >= fromMin && minutes < toMin) return block.alarm;
    } else {
      if (minutes >= fromMin || minutes < toMin) return block.alarm;
    }
  }
  // Fallback: erster Block
  return blocks[0]?.alarm;
}

// Hilfsfunktion: Hole den passenden Warn-Schwellenwert für eine Tabellenzeile
function getWarningThresholdForRow(row: TableRowType, config: ConfigType): number | undefined {
  if (!config?.thresholdsByStationAndTime || !row.station || !row.time) return undefined;
  let stationKey = typeof row.station === 'string' ? row.station.toLowerCase() : '';
  if (stationKey === "techno floor") stationKey = "techno";
  if (stationKey === "band bühne") stationKey = "band";
  const time = row.time.slice(0, 5);
  const blocks = config.thresholdsByStationAndTime[stationKey as StationKey];
  if (!blocks) return undefined;
  const [h, m] = time.split(":").map(Number);
  const minutes = h * 60 + m;
  for (const block of blocks) {
    const [fromH, fromM] = block.from.split(":").map(Number);
    const [toH, toM] = block.to.split(":").map(Number);
    const fromMin = fromH * 60 + fromM;
    const toMin = toH * 60 + toM;
    if (fromMin < toMin) {
      if (minutes >= fromMin && minutes < toMin) return block.warning;
    } else {
      if (minutes >= fromMin || minutes < toMin) return block.warning;
    }
  }
  return blocks[0]?.warning;
}

export function AllStationsTable({ ortData, heuballernData, technoData, bandData, config, granularity, page, setPage, pageSize, totalCount, alarmRows, showOnlyAlarms: showOnlyAlarmsProp, onAlarmToggle, onTopRowChange, filterStation: filterStationProp }: AllStationsTableProps) {
  const [showWeather, setShowWeather] = useState(false)
  const [search, setSearch] = useState("")
  const [filterStation, setFilterStation] = useState("__all__") // Default: Alle Stationen
  // If filterStationProp is set, override the filterStation state
  const effectiveFilterStation = filterStationProp !== undefined ? filterStationProp : filterStation;
  const [filterDate, setFilterDate] = useState("")
  // const [filter15min, setFilter15min] = useState(false) // Entfernt, da Aggregation jetzt über API
  // showOnlyAlarms: Entweder Prop oder lokaler State (Fallback)
  const [showOnlyAlarmsState, setShowOnlyAlarmsState] = useState(false)
  const showOnlyAlarms = showOnlyAlarmsProp !== undefined ? showOnlyAlarmsProp : showOnlyAlarmsState
  const handleAlarmToggle = onAlarmToggle ?? setShowOnlyAlarmsState

  // Gesamtdaten für Filter und Dropdowns
  const allRawRows: TableRowType[] = [
    ...ortData.map(row => ({ ...row, station: "Ort" })),
    ...technoData.map(row => ({ ...row, station: "Techno Floor" })),
    ...bandData.map(row => ({ ...row, station: "Band Bühne" })),
    ...heuballernData.map(row => ({ ...row, station: "Heuballern" })),
  ];

  // tableRows: Im Alarmmodus alarmRows, sonst wie bisher
  const tableRows: TableRowType[] = showOnlyAlarms && alarmRows ? alarmRows : allRawRows;

  // Dropdowns: Alle Daten (nicht nur aktuelle Seite)
  const allStations = useMemo(() => Array.from(new Set(allRawRows.map(r => r.station))), [allRawRows])
  // allDatesList: Alle Datumswerte aus dem gesamten, ungefilterten Datensatz (unabhängig von Pagination/Filter)
  const allDatesList = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRawRows) {
      const d = parseDate(r.datetime);
      if (d) set.add(d.toLocaleDateString('de-DE'));
    }
    return Array.from(set).sort((a, b) => {
      // Sortiere nach Datum absteigend
      const da = a.split('.').reverse().join('-');
      const db = b.split('.').reverse().join('-');
      return db.localeCompare(da);
    });
  }, [allRawRows]);

  // Debug: Logge die eingehenden Daten für Analyse
  if (typeof window !== 'undefined') {
    console.log('[AllStationsTable] ortData:', ortData.map(r => r.datetime));
    console.log('[AllStationsTable] technoData:', technoData.map(r => r.datetime));
    console.log('[AllStationsTable] bandData:', bandData.map(r => r.datetime));
  }
  // Sortier-Logik
  const [sortKey, setSortKey] = useState<string>('datetime')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const tableColumns: DataTableColumn<TableRowType>[] = [
    { label: "Datum", key: "datetime", sortable: true, 
      sortFn: (a: TableRowType, b: TableRowType, dir: 'asc' | 'desc') => {
        const aDate = parseDate(a.datetime);
        const bDate = parseDate(b.datetime);
        if (!aDate || !bDate) return 0;
        return dir === 'asc' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
      },
      render: (row: TableRowType) => {
        if (!row.datetime) return "-"
        const d = parseDate(row.datetime)
        // Debug-Log entfernt
        return d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : row.datetime
      } },
    { label: "Zeit", key: "time", sortable: true, render: (row: TableRowType) => {
      if (row.time && /^\d{2}:\d{2}/.test(row.time)) return row.time.slice(0, 5);
      if (row.datetime && row.datetime.length >= 16) return row.datetime.slice(11, 16);
      return "-";
    } },
    { label: "dB", key: "las", sortable: true, render: (row: TableRowType) => {
      if (row.las === undefined) return "-";
      const alarm = getAlarmThresholdForRow(row, config as ConfigType);
      const warning = getWarningThresholdForRow(row, config as ConfigType);
      // StationKey für Farblogik extrahieren
      let stationKey = typeof row.station === 'string' ? row.station.toLowerCase() : '';
      if (stationKey === "techno floor") stationKey = "techno";
      if (stationKey === "band bühne") stationKey = "band";
      // chartColor aus STATION_META
      const chartColor = STATION_META[stationKey as StationKey]?.chartColor;
      let bg = "";
      let badgeColor = chartColor ? `ring-2 ring-[${chartColor}]` : "bg-emerald-200 dark:bg-emerald-900/30";
      let badgeLabel = "Normalbereich";
      if (typeof alarm === 'number' && row.las >= alarm) {
        bg = "bg-red-100 dark:bg-red-900/30";
        badgeColor = "bg-red-400 dark:bg-red-700";
        badgeLabel = "Alarm";
      } else if (typeof warning === 'number' && row.las >= warning) {
        bg = "bg-yellow-100 dark:bg-yellow-900/30";
        badgeColor = "bg-yellow-300 dark:bg-yellow-700";
        badgeLabel = "Warnung";
      }
      return (
        <UITooltip>
          <TooltipTrigger asChild>
            <span className={`px-2 py-1 rounded inline-flex items-center gap-1 ${bg}`}
              tabIndex={0}
              aria-label={`Lärmpegel: ${Math.round(row.las)} dB, Status: ${badgeLabel}, Warnung ab ${typeof warning === 'number' ? Math.round(warning) : '-'} dB, Alarm ab ${typeof alarm === 'number' ? Math.round(alarm) : '-'} dB`}
            >
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${badgeColor}`} aria-label={badgeLabel} />
              {Math.round(row.las)}
              <Info className="w-3 h-3 text-gray-400 ml-1" aria-hidden="true" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <div><b>Status:</b> {badgeLabel}</div>
              <div><b>Warnung ab:</b> {typeof warning === 'number' ? Math.round(warning) : '-'} dB</div>
              <div><b>Alarm ab:</b> {typeof alarm === 'number' ? Math.round(alarm) : '-'} dB</div>
            </div>
          </TooltipContent>
        </UITooltip>
      );
    } },
    ...(showWeather ? [
      { label: "Wind", key: "ws", sortable: true, render: (row: TableRowType) => (row.ws !== undefined && row.ws !== null) ? row.ws.toFixed(1) : "-" },
      { label: "Richtung", key: "wd", render: (row: TableRowType) => (row.wd !== undefined && row.wd !== null && row.wd !== '') ? windDirectionText(row.wd) : "-" },
      { label: "Luftfeuchte", key: "rh", render: (row: TableRowType) => (row.rh !== undefined && row.rh !== null) ? row.rh.toFixed(0) + '%' : "-" },
    ] : []),
    { label: "Ort", key: "station", sortable: true },
  ]

  // Sortierung sollte serverseitig erfolgen, nicht im Frontend
  const filteredRows = useMemo(() => {
    // Wenn wir serverseitige Pagination haben, sind die Daten bereits sortiert
    if (page !== undefined && pageSize !== undefined && totalCount !== undefined) {
      return tableRows; // Bereits serverseitig sortiert
    }
    
    // Fallback: Frontend-Sortierung nur für lokale Daten
    let rows = tableRows;
    const col = tableColumns.find(c => c.key === sortKey);
    if (col && typeof col.sortFn === 'function') {
      rows = [...rows].sort((a, b) => col.sortFn!(a, b, sortDir));
    } else {
      rows = [...rows].sort((a, b) => {
        const aVal = a[sortKey as keyof TableRowType];
        const bVal = b[sortKey as keyof TableRowType];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortDir === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }
    return rows;
  }, [tableRows, sortKey, sortDir, tableColumns, page, pageSize, totalCount]);

  // Filterung: "Nur Alarme" zeigt ausschließlich Datensätze, die als Alarm eingestuft sind
  const effectivePage = page ?? 1
  const effectiveSetPage = setPage ?? (() => {})
  const effectivePageSize = pageSize ?? 25
  const pageCount = Math.ceil(filteredRows.length / effectivePageSize);
  const pagedRows = useMemo<TableRowType[]>(() => {
    // Wenn serverseitiges Paging: ortData, technoData, ... sind schon die aktuelle Seite
    if (page !== undefined && pageSize !== undefined && totalCount !== undefined) {
      return filteredRows // filteredRows ist schon die aktuelle Seite
    }
    // Fallback: clientseitiges Paging
    return filteredRows.slice((effectivePage-1)*effectivePageSize, effectivePage*effectivePageSize)
  }, [filteredRows, effectivePage, effectivePageSize, page, pageSize, totalCount])

  // Notify parent of the top row (first visible row) whenever pagedRows changes
  React.useEffect(() => {
    if (onTopRowChange) {
      if (typeof window !== 'undefined') {
        console.log('[AllStationsTable] onTopRowChange', {
          filterStation: filterStationProp,
          pagedRows: pagedRows.map(r => ({ station: r.station, datetime: r.datetime, las: r.las })),
          topRow: pagedRows.length > 0 ? { station: pagedRows[0].station, datetime: pagedRows[0].datetime, las: pagedRows[0].las } : null
        });
      }
      onTopRowChange(pagedRows.length > 0 ? pagedRows[0] : null);
    }
  }, [onTopRowChange, pagedRows, filterStationProp]);

  function handleSort(key: string) {
    const newSortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'
    setSortKey(key)
    setSortDir(newSortDir)
    
    // Wenn serverseitige Pagination aktiv ist, informiere Parent-Komponente über Sortierung
    if (page !== undefined && pageSize !== undefined && totalCount !== undefined && setPage) {
      // Reset auf Seite 1 bei neuer Sortierung
      setPage(1)
      // TODO: Parent-Komponente muss sortBy/sortOrder an API weiterleiten
      if (typeof window !== 'undefined') {
        console.log('[AllStationsTable] Sortierung geändert:', { sortKey: key, sortDir: newSortDir })
      }
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

  // Debug: Logge die Datenmengen für Analyse
  if (typeof window !== 'undefined') {
    console.log('[AllStationsTable] tableRows:', tableRows.length, tableRows[0]);
    console.log('[AllStationsTable] filteredTableRows:', filteredRows.length, filteredRows[0]);
    console.log('[AllStationsTable] filteredRows:', filteredRows.length, filteredRows[0]);
  }

  return (
    <Card className="mb-10 rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800">
      <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
        <TableIcon className="w-6 h-6 text-blue-500" />
        <span className="text-xl font-bold text-gray-900 dark:text-white">Tabellenansicht</span>
        {granularity && (
          <span className="ml-4 px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold">
            {granularity} Daten
          </span>
        )}
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
                {allDatesList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {allStations.length > 1 && (
            <div className="w-full md:w-[150px]">
              <Select value={effectiveFilterStation} onValueChange={setFilterStation}>
                <SelectTrigger className="w-[160px]">
                  <span>{effectiveFilterStation === "__all__" ? "Alle Stationen" : effectiveFilterStation}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="all" value="__all__">Alle Stationen</SelectItem>
                  {allStations.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="w-full md:w-[170px]">
            {/* Removed filter15min Select */}
          </div>
          <div className="flex-1" />
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto min-w-[320px] h-10 mt-2 md:mt-0">
            <div className="flex items-center gap-2 flex-1 px-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <UITooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Wind className="w-5 h-5 text-cyan-700 dark:text-cyan-300" />
                    <Label htmlFor="showWeather" className="text-xs font-medium">Wetterspalten</Label>
                    <Switch id="showWeather" checked={showWeather} onCheckedChange={setShowWeather} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Wetterspalten anzeigen</TooltipContent>
              </UITooltip>
            </div>
            <div className="flex items-center gap-2 flex-1 px-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <UITooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={"w-5 h-5 " + (showOnlyAlarms ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-600")}/>
                    <Label htmlFor="showOnlyAlarms" className="text-xs font-medium">Nur Alarme</Label>
                    <Switch id="showOnlyAlarms" checked={!!showOnlyAlarms} onCheckedChange={handleAlarmToggle} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Nur Einträge mit Alarm anzeigen</TooltipContent>
              </UITooltip>
            </div>
          </div>
        </div>
        <ScrollArea className="w-full max-w-full pb-2 min-w-[320px]">
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
                    {col.label}
                    {getSortIcon(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <MemoizedTableBody rows={pagedRows} tableColumns={tableColumns} />
          </table>
        </ScrollArea>
        {/*
          Für noch größere Tabellen kann react-window für virtuelles Scrolling genutzt werden:
          https://react-window.vercel.app/#/examples/list/fixed-size
          Die aktuelle Pagination bleibt dabei als Fallback erhalten.
        */}
        <Pagination className="mt-4 select-none min-w-[180px]">
            <PaginationContent>
              <PaginationItem>
                <button
                  onClick={() => effectiveSetPage(Math.max(1, effectivePage - 1))}
                  className="h-8 w-8 md:h-9 md:w-9 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition disabled:opacity-50"
                  disabled={effectivePage === 1}
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
                for (let i = Math.max(2, effectivePage - delta); i <= Math.min(maxPages - 1, effectivePage + delta); i++) {
                  range.push(i);
                }
                if (maxPages <= 7) {
                  for (let i = 1; i <= maxPages; i++) {
                    items.push(
                      <PaginationItem key={i}>
                        <PaginationLink isActive={i === effectivePage} onClick={() => effectiveSetPage(i)} className="h-8 w-8 md:h-9 md:w-9 rounded-lg text-base font-semibold" >{i}</PaginationLink>
                      </PaginationItem>
                    );
                  }
                } else {
                  items.push(
                    <PaginationItem key={1}>
                      <PaginationLink isActive={effectivePage === 1} onClick={() => effectiveSetPage(1)}>1</PaginationLink>
                    </PaginationItem>
                  );
                  if (effectivePage - delta > 2) {
                    items.push(<PaginationItem key="start-ellipsis"><span className="px-2 text-lg">…</span></PaginationItem>);
                  }
                  range.forEach(i => {
                    items.push(
                      <PaginationItem key={i}>
                        <PaginationLink isActive={i === effectivePage} onClick={() => effectiveSetPage(i)} className="h-8 w-8 md:h-9 md:w-9 rounded-lg text-base font-semibold">{i}</PaginationLink>
                      </PaginationItem>
                    );
                  });
                  if (effectivePage + delta < maxPages - 1) {
                    items.push(<PaginationItem key="end-ellipsis"><span className="px-2 text-lg">…</span></PaginationItem>);
                  }
                  if (maxPages > 1) {
                    items.push(
                      <PaginationItem key={maxPages}>
                        <PaginationLink isActive={effectivePage === maxPages} onClick={() => effectiveSetPage(maxPages)} className="h-8 w-8 md:h-9 md:w-9 rounded-lg text-base font-semibold">{maxPages}</PaginationLink>
                      </PaginationItem>
                    );
                  }
                }
                return items;
              })()}
              <PaginationItem>
                <button
                  onClick={() => effectiveSetPage(Math.min(pageCount, effectivePage + 1))}
                  className="h-8 w-8 md:h-9 md:w-9 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition disabled:opacity-50"
                  disabled={effectivePage === pageCount}
                  aria-label="Nächste Seite"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
      </CardContent>
    </Card>
  )
}

const MemoizedTableBody = React.memo(function MemoizedTableBody({ rows, tableColumns }: { rows: TableRowType[], tableColumns: DataTableColumn<TableRowType>[] }) {
  if (rows.length === 0) {
    return <tbody><tr><td colSpan={tableColumns.length} className="text-gray-400 text-center py-4">Keine Daten</td></tr></tbody>
  }
  return (
    <tbody>
      {rows.map((row, i) => (
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
              {(() => {
                const value = col.render ? col.render(row) : row[col.key as keyof TableRowType];
                return typeof value === 'number' ? parseInt(String(value), 10) : value;
              })()}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
})