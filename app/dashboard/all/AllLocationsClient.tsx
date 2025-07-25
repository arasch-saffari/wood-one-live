"use client"
import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wind, AlertTriangle, Table as TableIcon, Activity, Droplets, Thermometer, Calendar, Database as DbIcon } from "lucide-react"
import { useStationData } from "@/hooks/useStationData"
import Link from "next/link"
import { STATION_META } from "@/lib/stationMeta"
import { TooltipProvider, Tooltip as UITooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useWeatherData } from "@/hooks/useWeatherData"
import { useConfig } from "@/hooks/useConfig"
import { cn } from '@/lib/utils'
import ChartPlayground from '@/components/ChartPlayground'
import { useHealth } from "@/hooks/useHealth"
import { useCsvWatcherStatus } from "@/hooks/useCsvWatcherStatus"
import { AllStationsTable } from "@/components/AllStationsTable"
import { GlobalLoader } from "@/components/GlobalLoader"
import type { StationDataPoint } from "@/hooks/useStationData"
import { parseDate } from '@/components/AllStationsTable';
import type { TableRowType } from '@/components/AllStationsTable';

// Add types for thresholds
interface ThresholdBlock {
  from: string;
  to: string;
  warning: number;
  alarm: number;
  las?: number;
  laf?: number;
}
interface ConfigWithThresholds {
  thresholdsByStationAndTime: Record<string, ThresholdBlock[]>;
  [key: string]: unknown;
}

interface AllLocationsClientProps {
  ortData: StationDataPoint[]
  heuballernData: StationDataPoint[]
  technoData: StationDataPoint[]
  bandData: StationDataPoint[]
  config?: Record<string, unknown> | null;
}

// Locally define StationKey and ConfigType
type StationKey = "ort" | "techno" | "band" | "heuballern";

// Add minimal types for health and watcher
interface HealthType {
  dbSize?: number;
  integrityProblem?: boolean;
  integrityCount?: number;
  lastBackup?: string;
}
interface WatcherType {
  watcherActive?: boolean;
  watchedDirectories?: { station: string }[];
}

export default function AllLocationsClient({ ortData: initialOrt, heuballernData: initialHeuballern, technoData: initialTechno, bandData: initialBand, config: initialConfig }: AllLocationsClientProps) {
  // 1. Context und State
  const { config } = useConfig();
  // 2. Daten-Hooks für Charts (jetzt 15min-Aggregation, ohne Limit)
  const pageSize = 1000;
  const ortDataObj = useStationData("ort", "24h", 60000, 1, pageSize, "15min");
  const heuballernDataObj = useStationData("heuballern", "24h", 60000, 1, pageSize, "15min");
  const technoDataObj = useStationData("techno", "24h", 60000, 1, pageSize, "15min");
  const bandDataObj = useStationData("band", "24h", 60000, 1, pageSize, "15min");
  const ortData = (ortDataObj.data && ortDataObj.data.length ? ortDataObj.data : (initialOrt ?? [])) || [];
  const heuballernData = (heuballernDataObj.data && heuballernDataObj.data.length ? heuballernDataObj.data : (initialHeuballern ?? [])) || [];
  const technoData = (technoDataObj.data && technoDataObj.data.length ? technoDataObj.data : (initialTechno ?? [])) || [];
  const bandData = (bandDataObj.data && bandDataObj.data.length ? bandDataObj.data : (initialBand ?? [])) || [];
  const ortLoading = ortDataObj.loading
  const heuballernLoading = heuballernDataObj.loading
  const technoLoading = technoDataObj.loading
  const bandLoading = bandDataObj.loading
  // Daten für Tabelle (immer 15min Aggregation, ohne Limit)
  function sortByDatetimeDesc(arr) {
    return [...arr].sort((a, b) => {
      const da = parseDate(a.datetime)?.getTime() ?? 0;
      const db = parseDate(b.datetime)?.getTime() ?? 0;
      return db - da;
    });
  }
  const mappedOrtData = sortByDatetimeDesc(ortData.map(row => ({
    ...row,
    station: "Ort",
    time: row.time && /^\d{2}:\d{2}/.test(row.time)
      ? row.time.slice(0, 5)
      : (row.datetime && row.datetime.length >= 16 ? row.datetime.slice(11, 16) : undefined)
  })));
  const mappedHeuballernData = sortByDatetimeDesc(heuballernData.map(row => ({
    ...row,
    station: "Heuballern",
    time: row.time && /^\d{2}:\d{2}/.test(row.time)
      ? row.time.slice(0, 5)
      : (row.datetime && row.datetime.length >= 16 ? row.datetime.slice(11, 16) : undefined)
  })));
  const mappedTechnoData = sortByDatetimeDesc(technoData.map(row => ({
    ...row,
    station: "Techno Floor",
    time: row.time && /^\d{2}:\d{2}/.test(row.time)
      ? row.time.slice(0, 5)
      : (row.datetime && row.datetime.length >= 16 ? row.datetime.slice(11, 16) : undefined)
  })));
  const mappedBandData = sortByDatetimeDesc(bandData.map(row => ({
    ...row,
    station: "Band Bühne",
    time: row.time && /^\d{2}:\d{2}/.test(row.time)
      ? row.time.slice(0, 5)
      : (row.datetime && row.datetime.length >= 16 ? row.datetime.slice(11, 16) : undefined)
  })));
  const { weather: latestWeather } = useWeatherData("global", "now")
  const { health } = useHealth();
  const { watcherStatus } = useCsvWatcherStatus();
  const watcher: WatcherType | null | undefined = watcherStatus;
  useEffect(() => {
    if ((config || initialConfig) && ortData.length && technoData.length && bandData.length && heuballernData.length) {
      // setShowLoader(false) // This line was removed as per the edit hint.
    }
  }, [config, initialConfig, ortData, technoData, bandData, heuballernData])
  const effectiveConfig = config || initialConfig
  // Entferne globalen showLoader-Block, zeige stattdessen pro Station einen Ladezustand an
  if (!effectiveConfig) {
    return (
      <GlobalLoader 
        text="Dashboard wird geladen ..." 
        progress={80}
        icon={<DbIcon className="w-10 h-10 text-white drop-shadow-lg" />}
      />
    )
  }
  // Chart-Daten für alle Standorte und Windgeschwindigkeit zusammenführen
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
  // Für jede Station aktuelle Zeit und Schwellenwerte bestimmen
  const getThresholds = (station: StationKey, data: Array<{ datetime?: string }>): ThresholdBlock | undefined => {
    const now = data.length > 0 ? data[data.length - 1].datetime?.slice(11,16) : undefined
    if (!effectiveConfig || !now) return undefined;
    const blocks = (effectiveConfig as ConfigWithThresholds).thresholdsByStationAndTime?.[station];
    if (!blocks) return undefined;
    const currentBlock = blocks.find((block: ThresholdBlock) => {
      if (!block.from || !block.to) return false;
      if (block.from < block.to) {
        return now >= block.from && now < block.to;
      } else {
        return now >= block.from || now < block.to;
      }
    });
    return currentBlock;
  }
  // Status-Farbe basierend auf Lärmwert bestimmen
  const getStatusColor = (level: number, station: StationKey, data: Array<{ datetime?: string }>) => {
    const thresholds = getThresholds(station, data)
    if (thresholds?.alarm !== undefined && level >= thresholds.alarm) return "text-red-400"
    if (thresholds?.warning !== undefined && level >= thresholds.warning) return "text-yellow-400"
    return "text-emerald-400"
  }
  // Status-Badge basierend auf Lärmwert
  const getStatusBadge = (level: number, station: StationKey, data: Array<{ datetime?: string }>) => {
    const thresholds = getThresholds(station, data)
    if (thresholds?.alarm !== undefined && level >= thresholds.alarm) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge>
    if (thresholds?.warning !== undefined && level >= thresholds.warning) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge>
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Normal</Badge>
  }
  const WIND_COLOR = (effectiveConfig as ConfigWithThresholds)?.chartColors && (effectiveConfig as ConfigWithThresholds).chartColors.wind ? (effectiveConfig as ConfigWithThresholds).chartColors.wind : "#06b6d4";
  // Fallback für Backup-Info
  const backupInfo = (typeof health === 'object' && health !== null && 'lastBackup' in health && (health as HealthType).lastBackup)
    ? { lastBackup: (health as HealthType).lastBackup } : null;
  const lines = [
    { key: 'ort', label: STATION_META.ort.name, color: STATION_META.ort.chartColor },
    { key: 'heuballern', label: STATION_META.heuballern.name, color: STATION_META.heuballern.chartColor },
    { key: 'techno', label: STATION_META.techno.name, color: STATION_META.techno.chartColor },
    { key: 'band', label: STATION_META.band.name, color: STATION_META.band.chartColor },
    { key: 'windSpeed', label: 'Windgeschwindigkeit', color: WIND_COLOR, yAxisId: 'wind', strokeDasharray: '5 5' },
  ]
  const axes = [
    { id: 'left', orientation: 'left' as const, domain: [30, 85] as [number, number], label: 'dB' },
    { id: 'wind', orientation: 'right' as const, domain: [0, 25] as [number, number], label: 'km/h' },
  ]
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
  // State for top row of each station (by label)
  const [topRows, setTopRows] = useState<{ [label: string]: TableRowType | null }>({});
  const handleTopRowChange = (label: string) => (row: TableRowType | null) => {
    setTopRows(prev => ({ ...prev, [label]: row }));
  };

  // Render hidden AllStationsTable for each station to track top row
  useEffect(() => {
    // No-op, just to ensure topRows is always up to date
  }, [topRows]);

  // Helper: station label mapping (for filter and KPI mapping)
  const stationLabels: { [key in StationKey]: string } = {
    ort: 'Ort',
    techno: 'Techno Floor',
    band: 'Band Bühne',
    heuballern: 'Heuballern',
  };
  // Reverse mapping for KPI lookup
  const labelToKey: { [label: string]: StationKey } = Object.fromEntries(Object.entries(stationLabels).map(([k, v]) => [v, k])) as any;

  // Helper: get top row for a station (latest by datetime desc)
  function getTopRow(data: TableRowType[]): TableRowType | null {
    if (!data || data.length === 0) return null;
    const sorted = [...data].sort((a, b) => {
      const da = parseDate(a.datetime)?.getTime() ?? 0;
      const db = parseDate(b.datetime)?.getTime() ?? 0;
      return db - da;
    });
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.log('[KPI-DEBUG] getTopRow sorted:', sorted.map(r => ({ datetime: r.datetime, las: r.las })));
      // eslint-disable-next-line no-console
      console.log('[KPI-DEBUG] getTopRow topRow:', { datetime: sorted[0]?.datetime, las: sorted[0]?.las });
    }
    return sorted[0] || null;
  }
  // Debug: Log sorted mappedOrtData and topRow for KPI
  if (typeof window !== 'undefined') {
    const sortedOrt = [...mappedOrtData].sort((a, b) => {
      const da = parseDate(a.datetime)?.getTime() ?? 0;
      const db = parseDate(b.datetime)?.getTime() ?? 0;
      return db - da;
    });
    const topOrt = sortedOrt[0];
    // eslint-disable-next-line no-console
    console.log('[KPI-DEBUG] mappedOrtData sorted:', sortedOrt.map(r => ({ datetime: r.datetime, las: r.las })));
    // eslint-disable-next-line no-console
    console.log('[KPI-DEBUG] topRow for Ort:', { datetime: topOrt?.datetime, las: topOrt?.las });
  }

  // Debug alert for Ort KPI box
  useEffect(() => {
    if (mappedOrtData && mappedOrtData.length > 0) {
      const firstTableRow = mappedOrtData[0];
      const debugRow = firstTableRow ? `mappedOrtData[0]: ${firstTableRow.datetime ?? '-'} | las: ${firstTableRow.las ?? '-'}` : 'mappedOrtData[0]: -';
      window.alert(`DEBUG: mappedOrtData.length = ${mappedOrtData.length}\nKPI-Box-Render-Check\n${debugRow}`);
    }
  }, [mappedOrtData && mappedOrtData.length]);
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
        {/* Standort-Übersicht Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 md:mb-10">
          {[stationLabels.ort, stationLabels.heuballern, stationLabels.techno, stationLabels.band].map((label) => {
            const key = labelToKey[label] as StationKey;
            const meta = STATION_META[key];
            const mappedData =
              key === 'ort' ? mappedOrtData :
              key === 'heuballern' ? mappedHeuballernData :
              key === 'techno' ? mappedTechnoData :
              mappedBandData;
            // KPI-Logik wie auf den Einzelstationsseiten: sortiere nach datetime desc, nimm ersten Wert
            const latest = mappedData.length > 0
              ? mappedData[0]
              : null;
            const level = latest?.las ?? null;
            const levelDisplay = typeof level === 'number' && !isNaN(level) ? Math.round(level) : null;
            // Sichtbare Debug-Zeile NUR für Ort: mappedOrtData.length, mappedOrtData[0], und erste Tabellenzeile
            let debugRow = '';
            if (label === 'Ort') {
              const firstTableRow = mappedOrtData[0];
              debugRow = firstTableRow ? `mappedOrtData[0]: ${firstTableRow.datetime ?? '-'} | las: ${firstTableRow.las ?? '-'}` : 'mappedOrtData[0]: -';
              // Trigger alert for debug info
              if (typeof window !== 'undefined') {
                window.alert(`DEBUG: mappedOrtData.length = ${mappedOrtData.length}\nKPI-Box-Render-Check\n${debugRow}`);
              }
            }
            // Sichtbare Debug-Zeile NUR für Ort: mappedOrtData.length und Render-Check
            const debugLength = (label === 'Ort') ? `DEBUG: mappedOrtData.length = ${mappedOrtData.length}` : '';
            const renderCheck = (label === 'Ort') ? 'KPI-Box-Render-Check' : '';
            return (
              <motion.div key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Link href={`/dashboard/${key}`}>
                  <Card className="rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 hover:scale-[1.025] transition-transform cursor-pointer">
                    <CardHeader className="flex flex-col items-center gap-2 p-6 md:p-8">
                      <span className="text-lg font-bold text-gray-900 dark:text-white mb-1">{meta.name}</span>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          {getStatusBadge(levelDisplay ?? 0, key, mappedData)}
                        </TooltipTrigger>
                        <TooltipContent>Status: {levelDisplay !== null ? levelDisplay : "keine daten"} dB</TooltipContent>
                      </UITooltip>
                      <span className={`text-2xl font-bold mt-2 mb-1 ${getStatusColor(levelDisplay ?? 0, key, mappedData)}`}>{levelDisplay !== null ? levelDisplay : "keine daten"} <span className="text-base font-normal text-gray-500">dB</span></span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">Klicken für Details →</span>
                      {label === 'Ort' && (
                        <>
                          <span className="block text-xs text-red-500 mt-2 font-mono">{debugLength}</span>
                          <span className="block text-xs text-blue-500 mt-1 font-mono">{renderCheck}</span>
                          <span className="block text-xs text-orange-500 mt-1 font-mono">{debugRow}</span>
                        </>
                      )}
                    </CardHeader>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
        {/* Multi-Line-Chart für alle Standorte */}
        <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="font-bold mb-2">Ort</h2>
            {ortLoading ? <GlobalLoader text="Ort lädt..." progress={40} /> : <ChartPlayground data={ortChartData as unknown as Record<string, unknown>[]}
              lines={[
                { key: 'las', label: STATION_META.ort.name, color: STATION_META.ort.chartColor, yAxisId: 'left' },
              ]}
              axes={[
                { id: 'left', orientation: 'left', domain: [30, 90], label: 'Lärmpegel (dB)', ticks: [30, 40, 50, 60, 70, 80, 90] }
              ]}
              title={STATION_META.ort.name}
              icon={null}
              thresholds={getThresholds('ort', ortData) ? [
                { value: getThresholds('ort', ortData).warning, label: 'Warnung', color: '#facc15', yAxisId: 'left' },
                { value: getThresholds('ort', ortData).alarm, label: 'Alarm', color: '#ef4444', yAxisId: 'left' },
              ] : []}
              granularity={undefined}
            />}
          </div>
          <div>
            <h2 className="font-bold mb-2">Heuballern</h2>
            {heuballernLoading ? <GlobalLoader text="Heuballern lädt..." progress={40} /> : <ChartPlayground data={heuballernChartData as unknown as Record<string, unknown>[]}
              lines={[
                { key: 'las', label: STATION_META.heuballern.name, color: STATION_META.heuballern.chartColor, yAxisId: 'left' },
              ]}
              axes={[
                { id: 'left', orientation: 'left', domain: [30, 90], label: 'Lärmpegel (dB)', ticks: [30, 40, 50, 60, 70, 80, 90] }
              ]}
              title={STATION_META.heuballern.name}
              icon={null}
              thresholds={getThresholds('heuballern', heuballernData) ? [
                { value: getThresholds('heuballern', heuballernData).warning, label: 'Warnung', color: '#facc15', yAxisId: 'left' },
                { value: getThresholds('heuballern', heuballernData).alarm, label: 'Alarm', color: '#ef4444', yAxisId: 'left' },
              ] : []}
              granularity={undefined}
            />}
          </div>
          <div>
            <h2 className="font-bold mb-2">Techno</h2>
            {technoLoading ? <GlobalLoader text="Techno lädt..." progress={40} /> : <ChartPlayground data={technoChartData as unknown as Record<string, unknown>[]}
              lines={[
                { key: 'las', label: STATION_META.techno.name, color: STATION_META.techno.chartColor, yAxisId: 'left' },
              ]}
              axes={[
                { id: 'left', orientation: 'left', domain: [30, 90], label: 'Lärmpegel (dB)', ticks: [30, 40, 50, 60, 70, 80, 90] }
              ]}
              title={STATION_META.techno.name}
              icon={null}
              thresholds={getThresholds('techno', technoData) ? [
                { value: getThresholds('techno', technoData).warning, label: 'Warnung', color: '#facc15', yAxisId: 'left' },
                { value: getThresholds('techno', technoData).alarm, label: 'Alarm', color: '#ef4444', yAxisId: 'left' },
              ] : []}
              granularity={undefined}
            />}
          </div>
          <div>
            <h2 className="font-bold mb-2">Band</h2>
            {bandLoading ? <GlobalLoader text="Band lädt..." progress={40} /> : <ChartPlayground data={bandChartData as unknown as Record<string, unknown>[]}
              lines={[
                { key: 'las', label: STATION_META.band.name, color: STATION_META.band.chartColor, yAxisId: 'left' },
              ]}
              axes={[
                { id: 'left', orientation: 'left', domain: [30, 90], label: 'Lärmpegel (dB)', ticks: [30, 40, 50, 60, 70, 80, 90] }
              ]}
              title={STATION_META.band.name}
              icon={null}
              thresholds={getThresholds('band', bandData) ? [
                { value: getThresholds('band', bandData).warning, label: 'Warnung', color: '#facc15', yAxisId: 'left' },
                { value: getThresholds('band', bandData).alarm, label: 'Alarm', color: '#ef4444', yAxisId: 'left' },
              ] : []}
              granularity={undefined}
            />}
          </div>
        </div>
        {/* Wetter-Übersicht Card */}
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
                    {/* windDirectionText(latestWeather?.windDir) */}
                    {typeof latestWeather?.windDir === 'string' || typeof latestWeather?.windDir === 'number' ? latestWeather.windDir : '–'}
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
        {/* Nach System Status Card, vor Grenzwert-Referenz: */}
        {(ortData.length > 0 || heuballernData.length > 0 || technoData.length > 0 || bandData.length > 0) ? (
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
        ) : (
          <div className="flex items-center justify-center min-h-[300px] text-gray-400 text-sm">Lade Daten ...</div>
        )}
        {/* Tabellenansicht */}
        <AllStationsTable
          ortData={mappedOrtData}
          heuballernData={mappedHeuballernData}
          technoData={mappedTechnoData}
          bandData={mappedBandData}
          config={effectiveConfig}
          granularity={"15min"}
          onTopRowChange={row => handleTopRowChange('ort')(row)}
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
                {effectiveConfig && (effectiveConfig as ConfigWithThresholds).thresholdsByStationAndTime &&
                  Object.entries((effectiveConfig as ConfigWithThresholds).thresholdsByStationAndTime).map(([station, blocks]) => {
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
                      <span>{st.data.length > 0 ? (() => { const d = parseDate(st.data[st.data.length - 1]?.datetime ?? ''); return d ? d.toLocaleDateString('de-DE') : '-'; })() : '-'}</span>
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
                  <li>Letztes Backup: <span className="font-mono">{backupInfo?.lastBackup ? new Date(backupInfo.lastBackup).toLocaleString('de-DE') : '-'}</span></li>
                  <li>CSV-Watcher: <span className={cn('font-mono', (watcher && watcher.watcherActive) ? 'text-green-600' : 'text-red-500')}>{(watcher && watcher.watcherActive) ? 'Aktiv' : 'Inaktiv'}</span></li>
                  <li>CSV-Ordner: <span className="font-mono">{(typeof watcher === 'object' && watcher !== null && 'watchedDirectories' in watcher && Array.isArray((watcher as WatcherType).watchedDirectories)) ? (watcher as WatcherType).watchedDirectories!.map((d: { station: string }) => d.station).join(', ') : ''}</span></li>
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
                  <li>Datenbankgröße: <span className="font-mono">{(typeof health === 'object' && health !== null && 'dbSize' in health && (health as HealthType).dbSize) ? (((health as HealthType).dbSize! / 1024 / 1024).toFixed(2)) : '-'} MB</span></li>
                  <li>Health-Status: <span className={(typeof health === 'object' && health !== null && 'integrityProblem' in health && (health as HealthType).integrityProblem) ? 'text-red-500 font-bold' : 'text-green-600 font-semibold'}>{(typeof health === 'object' && health !== null && 'integrityProblem' in health && (health as HealthType).integrityProblem) ? 'Fehlerhaft' : 'OK'}</span></li>
                  {(typeof health === 'object' && health !== null && 'integrityProblem' in health && (health as HealthType).integrityProblem) && (
                    <li className="text-xs text-red-500">Integritätsfehler: {(typeof health === 'object' && health !== null && 'integrityCount' in health ? (health as HealthType).integrityCount : '')}</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      {mappedOrtData && mappedOrtData.length > 0 && (
        <div style={{ background: '#fffae5', color: '#b45309', padding: '16px', borderRadius: '12px', marginBottom: '16px', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1.1em', border: '2px solid #facc15' }}>
          DEBUG: mappedOrtData.length = {mappedOrtData.length}<br />
          KPI-Box-Render-Check<br />
          mappedOrtData[0]: {mappedOrtData[0]?.datetime ?? '-'} | las: {mappedOrtData[0]?.las ?? '-'}
        </div>
      )}
    </TooltipProvider>
  )
} 