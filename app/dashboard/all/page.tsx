"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wind, AlertTriangle, Table as TableIcon, Activity, Droplets, Thermometer, Calendar, Database as DbIcon } from "lucide-react"
import { cn } from '@/lib/utils'
import { AllStationsTable, normalizeTableRow, TableRowType, StationKey, ConfigType, ThresholdBlock } from '@/components/AllStationsTable';
import { useStationData } from "@/hooks/useStationData"
import { GlobalLoader } from "@/components/GlobalLoader"
import Link from "next/link"
import { STATION_META } from "@/lib/stationMeta"
import {
  TooltipProvider,
  Tooltip as UITooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { useWeatherData } from "@/hooks/useWeatherData"
import { useConfig } from "@/hooks/useConfig"
import ChartPlayground from '@/components/ChartPlayground'
import { useHealth } from "@/hooks/useHealth"
import { useCsvWatcherStatus } from "@/hooks/useCsvWatcherStatus"
// ChartAxis inline definieren
type ChartAxis = {
  id: string;
  orientation: 'left' | 'right';
  domain: [number, number];
  label: string;
}

// Hilfsfunktion: Windrichtung (Grad oder Abkürzung) in ausgeschriebenen Text umwandeln
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

// Hilfsfunktion für Alarm-Schwellenwert (wie in AllStationsTable)
function getAlarmThresholdForRow(row: TableRowType, config: ConfigType): number | undefined {
  if (!config?.thresholdsByStationAndTime || !row.station || !row.time) return undefined;
  let stationKey = row.station.toLowerCase();
  if (stationKey === "techno floor") stationKey = "techno";
  if (stationKey === "band bühne") stationKey = "band";
  const time = row.time?.slice(0, 5);
  const blocks = config.thresholdsByStationAndTime[stationKey as StationKey];
  if (!blocks) return undefined;
  const [h, m] = time ? time.split(":").map(Number) : [0, 0];
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
  return blocks[0]?.alarm;
}

export default function AllLocationsPage() {
  // Logging für Hook-Reihenfolge-Debugging
  console.log("AllLocationsPage wird gerendert");
  // All hooks at the top, unconditionally
  // Paging-Logik für alle Stationen
  const pageSize = 50;
  const ortDataObj = useStationData("ort", "24h", 60000, 1, pageSize, "15min")
  const technoDataObj = useStationData("techno", "24h", 60000, 1, pageSize, "15min")
  const bandDataObj = useStationData("band", "24h", 60000, 1, pageSize, "15min")
  const heuballernDataObj = useStationData("heuballern", "24h", 60000, 1, pageSize, "15min")
  const ortData = ortDataObj.data ?? []
  const technoData = technoDataObj.data ?? []
  const bandData = bandDataObj.data ?? []
  const heuballernData = heuballernDataObj.data ?? []
  const [ortShowOnlyAlarms] = useState(false)
  const [technoShowOnlyAlarms] = useState(false)
  const [bandShowOnlyAlarms] = useState(false)
  const [heuballernShowOnlyAlarms] = useState(false)
  const { config } = useConfig() as { config: ConfigType | null };
  const { weather: latestWeather } = useWeatherData("global", "now")
  const { health } = useHealth() as { health: Partial<{ dbSize: number; integrityProblem: boolean; integrityCount: number; lastBackup?: string }> };
  const { watcherStatus: watcher } = useCsvWatcherStatus();
  
  // Pagination state for AllStationsTable
  const [tablePage, setTablePage] = React.useState(1);
  const tablePageSize = 25;
  
  // Sorting state for AllStationsTable
  const [sortBy, setSortBy] = React.useState<string>('datetime');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
  };

  // Datumsliste & Alarmdaten für jede Station
  // Datumsliste laden - WICHTIG: Alle useEffect Hooks vor dem frühen Return platzieren
  useEffect(() => {
    console.log("useEffect für Datumslisten wird ausgeführt");
    fetch('/api/station-data?station=heuballern&interval=24h&page=1&pageSize=1&aggregate=dates')
      .then(res => res.json())
      // kein setState nötig
  }, [])
  
  // Alarmdaten laden - Alle useEffect Hooks werden immer aufgerufen
  useEffect(() => {
    console.log("useEffect für ort Alarmdaten wird ausgeführt, ortShowOnlyAlarms:", ortShowOnlyAlarms);
    if (ortShowOnlyAlarms) {
      fetch(`/api/station-data?station=ort&interval=24h&page=${ortShowOnlyAlarms ? 1 : 1}&pageSize=${pageSize}&aggregate=alarms`)
        .then(res => res.json())
        // kein setState nötig
    } else {
      // kein setState nötig
    }
  }, [ortShowOnlyAlarms, pageSize])
  
  useEffect(() => {
    console.log("useEffect für techno Alarmdaten wird ausgeführt, technoShowOnlyAlarms:", technoShowOnlyAlarms);
    if (technoShowOnlyAlarms) {
      fetch(`/api/station-data?station=techno&interval=24h&page=${technoShowOnlyAlarms ? 1 : 1}&pageSize=${pageSize}&aggregate=alarms`)
        .then(res => res.json())
        // kein setState nötig
    } else {
      // kein setState nötig
    }
  }, [technoShowOnlyAlarms, pageSize])
  
  useEffect(() => {
    console.log("useEffect für band Alarmdaten wird ausgeführt, bandShowOnlyAlarms:", bandShowOnlyAlarms);
    if (bandShowOnlyAlarms) {
      fetch(`/api/station-data?station=band&interval=24h&page=${bandShowOnlyAlarms ? 1 : 1}&pageSize=${pageSize}&aggregate=alarms`)
        .then(res => res.json())
        // kein setState nötig
    } else {
      // kein setState nötig
    }
  }, [bandShowOnlyAlarms, pageSize])
  
  useEffect(() => {
    console.log("useEffect für heuballern Alarmdaten wird ausgeführt, heuballernShowOnlyAlarms:", heuballernShowOnlyAlarms);
    if (heuballernShowOnlyAlarms) {
      fetch(`/api/station-data?station=heuballern&interval=24h&page=${heuballernShowOnlyAlarms ? 1 : 1}&pageSize=${pageSize}&aggregate=alarms`)
        .then(res => res.json())
        // kein setState nötig
    } else {
      // kein setState nötig
    }
  }, [heuballernShowOnlyAlarms, pageSize])

  // Handler
  // 3. Lade-Status prüfen: Wenn Config oder Daten noch nicht geladen, Loader anzeigen
  if (!config) {
    return (
      <GlobalLoader 
        text="Dashboard wird geladen ..." 
        progress={80}
        icon={<DbIcon className="w-10 h-10 text-white drop-shadow-lg" />}
      />
    )
  }
  console.log("ConfigContext in AllLocationsPage:", config);

  // Chart-Daten für alle Standorte und Windgeschwindigkeit zusammenführen
  // Zeitbasis: Vereinigung aller Zeitpunkte aller Stationen
  const chartTimes = Array.from(new Set([
    ...ortData.map(d => d.time),
    ...bandData.map(d => d.time),
    ...technoData.map(d => d.time),
    ...heuballernData.map(d => d.time),
  ])).sort();
  const chartData = chartTimes.map(time => {
    const ort = ortData.find((d) => d.time === time)
    const techno = technoData.find((d) => d.time === time)
    const band = bandData.find((d) => d.time === time)
    const heuballern = heuballernData.find((d) => d.time === time)
    // Windgeschwindigkeit: Mittelwert der vier Standorte, falls vorhanden
    const windVals = [ort, techno, band, heuballern].map(d => d?.ws).filter((v): v is number => typeof v === 'number')
    const windSpeed = windVals.length > 0 ? (windVals.reduce((a, b) => a + b, 0) / windVals.length) : undefined
    return {
      time,
      ort: ort?.las ?? null,
      techno: techno?.las ?? null,
      band: band?.las ?? null,
      heuballern: heuballern?.las ?? null,
      windSpeed: windSpeed ?? null,
    }
  })

  // Compose current levels for KPI cards (latest by datetime DESC, not last array element!)
  function getLatestLevel(data: TableRowType[]): number | null {
    if (!data || data.length === 0) return null;
    const sorted = [...data].sort((a, b) => {
      const da = a.datetime ? new Date(a.datetime.replace(' ', 'T')).getTime() : 0;
      const db = b.datetime ? new Date(b.datetime.replace(' ', 'T')).getTime() : 0;
      return db - da;
    });
    return sorted[0]?.las ?? null;
  }
  // Map all data to TableRowType (with .station) for correct typing
  const mappedOrtData: TableRowType[] = ortData.map(row => ({ ...row, station: "Ort" }));
  const mappedTechnoData: TableRowType[] = technoData.map(row => ({ ...row, station: "Techno Floor" }));
  const mappedBandData: TableRowType[] = bandData.map(row => ({ ...row, station: "Band Bühne" }));
  const mappedHeuballernData: TableRowType[] = heuballernData.map(row => ({ ...row, station: "Heuballern" }));
  const currentLevels = {
    ort: getLatestLevel(mappedOrtData),
    techno: getLatestLevel(mappedTechnoData),
    band: getLatestLevel(mappedBandData),
    heuballern: getLatestLevel(mappedHeuballernData),
  };

  // Für jede Station aktuelle Zeit und Schwellenwerte bestimmen
  const getThresholds = (station: StationKey, data: Array<{ datetime?: string }>) => {
    const now = data.length > 0 ? data[data.length - 1].datetime?.slice(11,16) : undefined
    if (!config || !now) return undefined;
    const blocks = config?.thresholdsByStationAndTime?.[station];
    if (!blocks) return undefined;
    const currentBlock = blocks?.find((block: ThresholdBlock) => {
      // Annahme: block.from und block.to im Format HH:MM
      if (!block.from || !block.to) return false;
      if (block.from < block.to) {
        // Tag-Block
        return now >= block.from && now < block.to;
      } else {
        // Nacht-Block (z.B. 20:00 - 08:00)
        return now >= block.from || now < block.to;
      }
    });
    return currentBlock;
  }

  // Status-Farbe basierend auf Lärmwert bestimmen
  const getStatusColor = (level: number, station: string, data: Array<{ datetime?: string }>) => {
    const thresholds = getThresholds(station as StationKey, data)
    if (thresholds?.alarm !== undefined && level >= thresholds.alarm) return "text-red-400"
    if (thresholds?.warning !== undefined && level >= thresholds.warning) return "text-yellow-400"
    return "text-emerald-400"
  }

  // Status-Badge basierend auf Lärmwert
  const getStatusBadge = (level: number, station: string, data: Array<{ datetime?: string }>) => {
    const thresholds = getThresholds(station as StationKey, data)
    if (thresholds?.alarm !== undefined && level >= thresholds.alarm) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge>
    if (thresholds?.warning !== undefined && level >= thresholds.warning) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge>
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Normal</Badge>
  }

  // Daten für das Chart filtern
  const WIND_COLOR = config?.chartColors?.wind || "#06b6d4" // cyan-500

  // Fallback für Backup-Info
  const backupInfo: { lastBackup?: string } | null = health && typeof health === 'object' && 'lastBackup' in health && typeof health.lastBackup === 'string' ? { lastBackup: health.lastBackup } : null

  // Definiere lines und axes für GenericChart:
  const lines = [
    { key: 'ort', label: STATION_META.ort.name, color: STATION_META.ort.chartColor },
    { key: 'heuballern', label: STATION_META.heuballern.name, color: STATION_META.heuballern.chartColor },
    { key: 'techno', label: STATION_META.techno.name, color: STATION_META.techno.chartColor },
    { key: 'band', label: STATION_META.band.name, color: STATION_META.band.chartColor },
    { key: 'windSpeed', label: 'Windgeschwindigkeit', color: WIND_COLOR, yAxisId: 'wind', strokeDasharray: '5 5' },
  ]
  const axes: ChartAxis[] = [
    { id: 'left', orientation: 'left', domain: [30, 85] as [number, number], label: 'dB' },
    { id: 'wind', orientation: 'right', domain: [0, 25] as [number, number], label: 'km/h' },
  ]

  // Debug-Ausgaben für chartData und lines
  console.log('chartData', chartData);
  console.log('lines', [
    { key: 'ort', label: STATION_META.ort.name, color: STATION_META.ort.chartColor },
    { key: 'band', label: STATION_META.band.name, color: STATION_META.band.chartColor },
    { key: 'techno', label: STATION_META.techno.name, color: STATION_META.techno.chartColor },
    { key: 'heuballern', label: STATION_META.heuballern.name, color: STATION_META.heuballern.chartColor },
  ]);

  // Chart für 'ort'
  const ortTimes = ortData.map(d => d.time).filter(Boolean).sort();
  const ortSlicedTimes = ortTimes.slice(ortTimes.length > 500 ? ortTimes.length - 500 : 0);
  const ortChartData = ortSlicedTimes.map(time => {
    const entry = ortData.find(d => d.time === time);
    return { time, las: entry?.las ?? null };
  });

  // Chart für 'band'
  const bandTimes = bandData.map(d => d.time).filter(Boolean).sort();
  const bandSlicedTimes = bandTimes.slice(bandTimes.length > 500 ? bandTimes.length - 500 : 0);
  const bandChartData = bandSlicedTimes.map(time => {
    const entry = bandData.find(d => d.time === time);
    return { time, las: entry?.las ?? null };
  });

  // Chart für 'techno'
  const technoTimes = technoData.map(d => d.time).filter(Boolean).sort();
  const technoSlicedTimes = technoTimes.slice(technoTimes.length > 500 ? technoTimes.length - 500 : 0);
  const technoChartData = technoSlicedTimes.map(time => {
    const entry = technoData.find(d => d.time === time);
    return { time, las: entry?.las ?? null };
  });

  // Chart für 'heuballern'
  const heuballernTimes = heuballernData.map(d => d.time).filter(Boolean).sort();
  const heuballernSlicedTimes = heuballernTimes.slice(heuballernTimes.length > 500 ? heuballernTimes.length - 500 : 0);
  const heuballernChartData = heuballernSlicedTimes.map(time => {
    const entry = heuballernData.find(d => d.time === time);
    return { time, las: entry?.las ?? null };
  });

  // Alarm-Zeilen für alle Stationen zusammenstellen
  const ortAlarmRows = ortData.map(row => ({
    ...row,
    station: "Ort",
    time: row.time?.match(/^\d{2}:\d{2}/) ? row.time?.slice(0, 5) : (row.datetime?.match(/(?:T| )(\d{2}:\d{2})/))?.[1]
  })).filter(row => {
    if (row.las === undefined || !config) return false;
    const alarmThreshold = getAlarmThresholdForRow(row, config);
    return alarmThreshold !== undefined && row.las >= alarmThreshold;
  });
  const heuballernAlarmRows = heuballernData.map(row => ({
    ...row,
    station: "Heuballern",
    time: row.time?.match(/^\d{2}:\d{2}/) ? row.time?.slice(0, 5) : (row.datetime?.match(/(?:T| )(\d{2}:\d{2})/))?.[1]
  })).filter(row => {
    if (row.las === undefined || !config) return false;
    const alarmThreshold = getAlarmThresholdForRow(row, config);
    return alarmThreshold !== undefined && row.las >= alarmThreshold;
  });
  const technoAlarmRows = technoData.map(row => ({
    ...row,
    station: "Techno Floor",
    time: row.time?.match(/^\d{2}:\d{2}/) ? row.time?.slice(0, 5) : (row.datetime?.match(/(?:T| )(\d{2}:\d{2})/))?.[1]
  })).filter(row => {
    if (row.las === undefined || !config) return false;
    const alarmThreshold = getAlarmThresholdForRow(row, config);
    return alarmThreshold !== undefined && row.las >= alarmThreshold;
  });
  const bandAlarmRows = bandData.map(row => ({
    ...row,
    station: "Band Bühne",
    time: row.time?.match(/^\d{2}:\d{2}/) ? row.time?.slice(0, 5) : (row.datetime?.match(/(?:T| )(\d{2}:\d{2})/))?.[1]
  })).filter(row => {
    if (row.las === undefined || !config) return false;
    const alarmThreshold = getAlarmThresholdForRow(row, config);
    return alarmThreshold !== undefined && row.las >= alarmThreshold;
  });
  const allAlarmRows = [
    ...ortAlarmRows,
    ...heuballernAlarmRows,
    ...technoAlarmRows,
    ...bandAlarmRows
  ];

  return (
    <TooltipProvider>
      <div className="space-y-4 lg:space-y-6">
        {/* Header Bereich */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between space-y-3 lg:space-y-0"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 lg:w-10 h-8 lg:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Activity className="w-4 lg:w-5 h-4 lg:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Alle Standorte</h1>
              <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">
                Übersicht aller Lärmmessstationen mit Echtzeit-Daten
              </p>
            </div>
          </div>
        </motion.div>
        {/* KPI-Karten: Standort-Übersicht */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 md:mb-10">
          {Object.entries(currentLevels).map(([location, level]) => {
            const meta = STATION_META[location as keyof typeof STATION_META]
            // Use correct data for each station for status badge/color
            let stationData: TableRowType[] = [];
            if (location === 'ort') stationData = mappedOrtData;
            else if (location === 'techno') stationData = mappedTechnoData;
            else if (location === 'band') stationData = mappedBandData;
            else if (location === 'heuballern') stationData = mappedHeuballernData;
            return (
              <motion.div key={location}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Link href={`/dashboard/${location}`}>
                  <Card className="rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 hover:scale-[1.025] transition-transform cursor-pointer">
                    <CardHeader className="flex flex-col items-center gap-2 p-6 md:p-8">
                      <span className="text-lg font-bold text-gray-900 dark:text-white mb-1">{meta.name}</span>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          {typeof level === "number" && !isNaN(level) ? getStatusBadge(level, location as StationKey, stationData) : <Badge className="bg-gray-300/20 text-gray-400 border-gray-300/30">keine daten</Badge>}
                        </TooltipTrigger>
                        <TooltipContent>Status: {typeof level === "number" && !isNaN(level) ? Math.round(level) : "keine daten"} dB</TooltipContent>
                      </UITooltip>
                      <span className={`text-2xl font-bold mt-2 mb-1 ${typeof level === "number" && !isNaN(level) ? getStatusColor(level, location as StationKey, stationData) : "text-gray-400"}`}>{typeof level === "number" && !isNaN(level) ? Math.round(level) : "keine daten"} <span className="text-base font-normal text-gray-500">dB</span></span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">Klicken für Details →</span>
                    </CardHeader>
                  </Card>
                </Link>
              </motion.div>
            )})}
        </div>

        {/* Wetter-Card über den Charts */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 mb-10">
            <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
              <Wind className="w-7 h-7 text-blue-500" />
              <span className="text-xl font-extrabold text-gray-900 dark:text-white">Wetter</span>
            </CardHeader>
            <CardContent className="pt-0 pb-8 px-2 md:px-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Wind className="w-4 h-4 text-blue-500" />Wind</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {latestWeather?.windSpeed !== undefined ? latestWeather.windSpeed.toFixed(1) : '–'} <span className="text-xs">km/h</span>
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Activity className="w-4 h-4 text-purple-500" />Windrichtung</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {windDirectionText(latestWeather?.windDir)}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Droplets className="w-4 h-4 text-cyan-500" />Luftfeuchte</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {latestWeather?.relHumidity !== undefined ? latestWeather.relHumidity.toFixed(0) : '–'}<span className="text-xs">%</span>
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Thermometer className="w-4 h-4 text-orange-500" />Temperatur</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {typeof latestWeather?.temperature === 'number' ? Math.round(latestWeather.temperature) : '–'}<span className="text-xs">°C</span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Einzelcharts für alle Standorte (max. 2 nebeneinander) */}
        <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          <ChartPlayground
            data={ortChartData.length > 0 ? ortChartData as unknown as Record<string, unknown>[] : []}
            lines={[
              { key: 'las', label: STATION_META.ort.name, color: STATION_META.ort.chartColor, yAxisId: 'left' },
            ]}
            axes={[
              { id: 'left', orientation: 'left', domain: [30, 90], label: 'Lärmpegel (dB)', ticks: [30, 40, 50, 60, 70, 80, 90] }
            ]}
            title={STATION_META.ort.name}
            icon={null}
            thresholds={(() => {
              const t = getThresholds('ort', mappedOrtData);
              return t ? [
                { value: t.warning, label: 'Warnung', color: '#facc15', yAxisId: 'left' },
                { value: t.alarm, label: 'Alarm', color: '#ef4444', yAxisId: 'left' },
              ] : [];
            })()}
            granularity={undefined}
          />
          <ChartPlayground
            data={heuballernChartData.length > 0 ? heuballernChartData as unknown as Record<string, unknown>[] : []}
            lines={[
              { key: 'las', label: STATION_META.heuballern.name, color: STATION_META.heuballern.chartColor, yAxisId: 'left' },
            ]}
            axes={[
              { id: 'left', orientation: 'left', domain: [30, 90], label: 'Lärmpegel (dB)', ticks: [30, 40, 50, 60, 70, 80, 90] }
            ]}
            title={STATION_META.heuballern.name}
            icon={null}
            thresholds={(() => {
              const t = getThresholds('heuballern', mappedHeuballernData);
              return t ? [
                { value: t.warning, label: 'Warnung', color: '#facc15', yAxisId: 'left' },
                { value: t.alarm, label: 'Alarm', color: '#ef4444', yAxisId: 'left' },
              ] : [];
            })()}
            granularity={undefined}
          />
          <ChartPlayground
            data={technoChartData.length > 0 ? technoChartData as unknown as Record<string, unknown>[] : []}
            lines={[
              { key: 'las', label: STATION_META.techno.name, color: STATION_META.techno.chartColor, yAxisId: 'left' },
            ]}
            axes={[
              { id: 'left', orientation: 'left', domain: [30, 90], label: 'Lärmpegel (dB)', ticks: [30, 40, 50, 60, 70, 80, 90] }
            ]}
            title={STATION_META.techno.name}
            icon={null}
            thresholds={(() => {
              const t = getThresholds('techno', mappedTechnoData);
              return t ? [
                { value: t.warning, label: 'Warnung', color: '#facc15', yAxisId: 'left' },
                { value: t.alarm, label: 'Alarm', color: '#ef4444', yAxisId: 'left' },
              ] : [];
            })()}
            granularity={undefined}
          />
          <ChartPlayground
            data={bandChartData.length > 0 ? bandChartData as unknown as Record<string, unknown>[] : []}
            lines={[
              { key: 'las', label: STATION_META.band.name, color: STATION_META.band.chartColor, yAxisId: 'left' },
            ]}
            axes={[
              { id: 'left', orientation: 'left', domain: [30, 90], label: 'Lärmpegel (dB)', ticks: [30, 40, 50, 60, 70, 80, 90] }
            ]}
            title={STATION_META.band.name}
            icon={null}
            thresholds={(() => {
              const t = getThresholds('band', mappedBandData);
              return t ? [
                { value: t.warning, label: 'Warnung', color: '#facc15', yAxisId: 'left' },
                { value: t.alarm, label: 'Alarm', color: '#ef4444', yAxisId: 'left' },
              ] : [];
            })()}
            granularity={undefined}
          />
        </div>

        {/* Multi-Line-Chart für alle Standorte */}
        <div className="w-full mb-10">
          <ChartPlayground
            data={chartData}
            lines={lines}
            axes={axes}
            title=""
            icon={null}
            granularity={undefined}
          />
        </div>

        {/* Tabellenansicht */}
        <AllStationsTable
          ortData={ortData.map(row => normalizeTableRow(row, 'ort'))}
          heuballernData={heuballernData.map(row => normalizeTableRow(row, 'heuballern'))}
          technoData={technoData.map(row => normalizeTableRow(row, 'techno'))}
          bandData={bandData.map(row => normalizeTableRow(row, 'band'))}
          config={config}
          granularity={"15min"}
          alarmRows={allAlarmRows}
          page={tablePage}
          setPage={setTablePage}
          pageSize={tablePageSize}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
        />
        {/* Grenzwert-Referenz */}
        <div className="mb-10">
          <Card className="rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800">
            <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">Grenzwert-Referenz</span>
            </CardHeader>
            <CardContent className="pt-0 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {config && config.thresholdsByStationAndTime &&
                  Object.entries(config.thresholdsByStationAndTime).map(([station, blocks]) => {
                  let showBlocks = blocks as ThresholdBlock[];
                  if (station === "ort" && Array.isArray(blocks) && blocks.length > 2) {
                    showBlocks = blocks.slice(0, 2);
                  }
                  return (
                    <Card key={station} className="rounded-xl bg-white/90 dark:bg-gray-900/70 border-0 shadow-md p-4">
                      <CardHeader className="pb-2 flex flex-col items-center gap-2 text-center">
                        <span className="text-base font-semibold text-gray-700 dark:text-gray-300 w-full text-center">
                          {station.charAt(0).toUpperCase() + station.slice(1)}
                        </span>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        {showBlocks.map((block: ThresholdBlock, i: number) => (
                          <div
                            key={i}
                            className="flex flex-col gap-1 p-2 rounded-lg mb-2 last:mb-0 transition-all hover:shadow-lg hover:ring-2 hover:ring-yellow-300/40 dark:hover:ring-yellow-500/30"
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
        {/* Systemstatus */}
        <div className="mb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 1. Stationen-Status */}
            <Card className="rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 flex flex-col">
              <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
                <Droplets className="w-6 h-6 text-emerald-500" />
                <span className="text-lg font-bold text-gray-900 dark:text-white">Letzte Aktualisierung</span>
              </CardHeader>
              <CardContent className="pt-0 pb-6">
                <ul className="text-xs space-y-1">
                  {([
                    { key: 'ort', data: ortData },
                    { key: 'heuballern', data: heuballernData },
                    { key: 'techno', data: technoData },
                    { key: 'band', data: bandData },
                  ] as const).map(st => (
                    <li key={st.key} className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full', STATION_META[st.key]?.chartColor ?? '')} />
                      <span>{STATION_META[st.key]?.name ?? st.key}:</span>
                      <span>{st.data.length > 0 ? st.data[st.data.length - 1]?.datetime ?? '-' : '-'}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-xs mt-2">Letztes Wetter-Update: {/* Wetter-LastUpdate kann hier angezeigt werden */}</div>
              </CardContent>
            </Card>
            {/* 2. Wetter & Backup */}
            <Card className="rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 flex flex-col">
              <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
                <Droplets className="w-6 h-6 text-cyan-500" />
                <span className="text-lg font-bold text-gray-900 dark:text-white">Wetter & Backup</span>
              </CardHeader>
              <CardContent className="pt-0 pb-6">
                <ul className="text-xs space-y-1">
                  <li>Letztes Backup: <span className="font-mono">{(backupInfo?.lastBackup ?? '') ? new Date(backupInfo?.lastBackup ?? '').toLocaleString('de-DE') : '-'}</span></li>
                  <li>CSV-Watcher: <span className={cn('font-mono', (watcher?.watcherActive ?? false) ? 'text-green-600' : 'text-red-500')}>{(watcher?.watcherActive ?? false) ? 'Aktiv' : 'Inaktiv'}</span></li>
                  <li>CSV-Ordner: <span className="font-mono">{Array.isArray(watcher?.watchedDirectories ?? []) ? (watcher?.watchedDirectories ?? []).map((d: { station: string }) => d.station).join(', ') : ''}</span></li>
                </ul>
              </CardContent>
            </Card>
            {/* 3. Systeminfos */}
            <Card className="rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 flex flex-col">
              <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
                <TableIcon className="w-6 h-6 text-violet-500" />
                <span className="text-lg font-bold text-gray-900 dark:text-white">System</span>
              </CardHeader>
              <CardContent className="pt-0 pb-6">
                <ul className="text-xs space-y-1">
                  <li>Datenbankgröße: <span className="font-mono">{typeof (health?.dbSize ?? undefined) === 'number' ? Math.round((health?.dbSize ?? 0) / 1024 / 1024) : '-'} MB</span></li>
                  <li>Health-Status: <span className={(health?.integrityProblem ?? false) ? 'text-red-500 font-bold' : 'text-green-600 font-semibold'}>{(health?.integrityProblem ?? false) ? 'Fehlerhaft' : 'OK'}</span></li>
                  {(health?.integrityProblem ?? false) && (
                    <li className="text-xs text-red-500">Integritätsfehler: {(health?.integrityCount ?? '')}</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
