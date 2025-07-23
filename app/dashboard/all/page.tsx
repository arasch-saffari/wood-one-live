"use client"

import React from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wind, AlertTriangle, Table as TableIcon, Activity, Droplets, Thermometer, Calendar, Database as DbIcon } from "lucide-react"
import { useStationData } from "@/hooks/useStationData"
import { useEffect, useState } from "react"
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
import { cn } from '@/lib/utils'
import { ChartPlayground } from '@/components/ChartPlayground'
import { useHealth } from "@/hooks/useHealth"
import { useCsvWatcherStatus } from "@/hooks/useCsvWatcherStatus"
import { AllStationsTable } from "@/components/AllStationsTable"
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
    // Falls es eine Abkürzung ist
    const map: Record<string, string> = {
      n: 'Norden', nne: 'Nordnordost', ne: 'Nordost', ene: 'Ostnordost',
      e: 'Osten', ese: 'Ostsüdost', se: 'Südost', sse: 'Südsüdost',
      s: 'Süden', ssw: 'Südsüdwest', sw: 'Südwest', wsw: 'Westsüdwest',
      w: 'Westen', wnw: 'Westnordwest', nw: 'Nordwest', nnw: 'Nordnordwest'
    };
    const key = typeof dir === 'string' ? dir.toLowerCase() : '';
    return map[key] || dir.toString();
  }
  // Gradzahl in Richtungstext
  const directions = [
    'Norden', 'Nordnordost', 'Nordost', 'Ostnordost',
    'Osten', 'Ostsüdost', 'Südost', 'Südsüdost',
    'Süden', 'Südsüdwest', 'Südwest', 'Westsüdwest',
    'Westen', 'Westnordwest', 'Nordwest', 'Nordnordwest', 'Norden'
  ];
  const idx = Math.round(((deg % 360) / 22.5));
  return directions[idx];
}

function useWeatherLastUpdate() {
  const [weatherLastUpdate, setWeatherLastUpdate] = useState<{ time: string|null } | null>(null)
  useEffect(() => {
    fetch('/api/weather/last-update')
      .then(res => res.json())
      .then(data => setWeatherLastUpdate(data))
      .catch(() => setWeatherLastUpdate(null))
  }, [])
  return weatherLastUpdate
}

// Definiere formatTime lokal:
function formatTime(latest: string | undefined) {
  if (!latest) return "-"
  const date = new Date(latest)
  if (isNaN(date.getTime())) return latest
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export default function AllLocationsPage() {
  // Ladezustand für alle Daten
  const [showLoader, setShowLoader] = useState(true)
  // 1. Context und State
  const { config } = useConfig();
  // Keine Granularität, Zeit oder maxPoints mehr

  // 2. Daten-Hooks
  const ortDataObj = useStationData("ort", "24h", 60000);
  const heuballernDataObj = useStationData("heuballern", "24h", 60000);
  const technoDataObj = useStationData("techno", "24h", 60000);
  const bandDataObj = useStationData("band", "24h", 60000);
  const ortData = ortDataObj.data ?? []
  const heuballernData = heuballernDataObj.data ?? []
  const technoData = technoDataObj.data ?? []
  const bandData = bandDataObj.data ?? []
  const { weather: latestWeather } = useWeatherData("global", "now")
  const weatherLastUpdate = useWeatherLastUpdate();
  const { health } = useHealth();
  const { watcherStatus: watcher } = useCsvWatcherStatus();

  // 3. Lade-Status prüfen: Wenn Config oder Daten noch nicht geladen, Loader anzeigen
  useEffect(() => {
    if (config && ortData.length && technoData.length && bandData.length && heuballernData.length) {
      setShowLoader(false)
    }
  }, [config, ortData, technoData, bandData, heuballernData])

  if (!config || showLoader) {
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

  // Compose current levels for KPI cards (last value in each array)
  const currentLevels = {
    ort: ortData.length > 0 ? ortData[ortData.length - 1].las : 0,
    techno: technoData.length > 0 ? technoData[technoData.length - 1].las : 0,
    band: bandData.length > 0 ? bandData[bandData.length - 1].las : 0,
    heuballern: heuballernData.length > 0 ? heuballernData[heuballernData.length - 1].las : 0,
  }

  // Für jede Station aktuelle Zeit und Schwellenwerte bestimmen
  const getThresholds = (station: string, data: Array<{ datetime?: string }>): any | undefined => {
    const now = data.length > 0 ? data[data.length - 1].datetime?.slice(11,16) : undefined
    if (!config || !now) return undefined;
    const blocks = config.thresholdsByStationAndTime?.[station];
    if (!blocks) return undefined;
    const currentBlock = blocks.find((block: any) => {
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
    const thresholds = getThresholds(station, data)
    if (thresholds?.alarm !== undefined && level >= thresholds.alarm) return "text-red-400"
    if (thresholds?.warning !== undefined && level >= thresholds.warning) return "text-yellow-400"
    return "text-emerald-400"
  }

  // Status-Badge basierend auf Lärmwert
  const getStatusBadge = (level: number, station: string, data: Array<{ datetime?: string }>) => {
    const thresholds = getThresholds(station, data)
    if (thresholds?.alarm !== undefined && level >= thresholds.alarm) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge>
    if (thresholds?.warning !== undefined && level >= thresholds.warning) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge>
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Normal</Badge>
  }

  // Daten für das Chart filtern
  const WIND_COLOR = config?.chartColors?.wind || "#06b6d4" // cyan-500

  // Fallback für Backup-Info
  const backupInfo = health && health.lastBackup ? { lastBackup: health.lastBackup } : null

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
          {Object.entries(currentLevels).map(([location, level]) => {
            const meta = STATION_META[location as keyof typeof STATION_META]
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
                          {getStatusBadge(level, location, ortData)}
                        </TooltipTrigger>
                        <TooltipContent>Status: {level.toFixed(1)} dB</TooltipContent>
                      </UITooltip>
                      <span className={`text-2xl font-bold mt-2 mb-1 ${getStatusColor(level, location, ortData)}`}>{level.toFixed(1)} <span className="text-base font-normal text-gray-500">dB</span></span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">Klicken für Details →</span>
                    </CardHeader>
                  </Card>
                </Link>
              </motion.div>
            )})}
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

        {/* Nach System Status Card, vor Grenzwert-Referenz: */}
        {(ortData.length > 0 || heuballernData.length > 0 || technoData.length > 0 || bandData.length > 0) ? (
          <div className="w-full mb-10">
            <ChartPlayground
              data={chartData}
              lines={lines}
              axes={axes}
              title=""
              icon={null}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[300px] text-gray-400 text-sm">Lade Daten ...</div>
        )}

        {/* Tabellenansicht (aus Zugvoegel, erweitert um Heuballern) */}
        <AllStationsTable
          ortData={ortData}
          heuballernData={heuballernData}
          technoData={technoData}
          bandData={bandData}
          config={config}
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
                {config && Object.entries(config.thresholdsByStationAndTime).map(([station, blocks]) => {
                  let showBlocks = blocks as Array<{ from: string; to: string; warning: number; alarm: number }>;
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
                        {showBlocks.map((block: { from: string; to: string; warning: number; alarm: number }, i: number) => (
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
                      <span className={cn('w-2 h-2 rounded-full', STATION_META[st.key].chartColor)} />
                      <span>{STATION_META[st.key].name}:</span>
                      <span>{formatTime(st.data.length > 0 ? st.data[st.data.length - 1].datetime : undefined)}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-xs mt-2">Letztes Wetter-Update: {formatTime(weatherLastUpdate?.time)}</div>
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
                  <li>CSV-Watcher: <span className={cn('font-mono', watcher?.watcherActive ? 'text-green-600' : 'text-red-500')}>{watcher?.watcherActive ? 'Aktiv' : 'Inaktiv'}</span></li>
                  <li>CSV-Ordner: <span className="font-mono">{watcher?.watchedDirectories?.map((d: any) => d.station).join(', ')}</span></li>
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
                  <li>Datenbankgröße: <span className="font-mono">{health?.dbSize ? (health.dbSize / 1024 / 1024).toFixed(2) : '-'} MB</span></li>
                  <li>Health-Status: <span className={health?.integrityProblem ? 'text-red-500 font-bold' : 'text-green-600 font-semibold'}>{health?.integrityProblem ? 'Fehlerhaft' : 'OK'}</span></li>
                  {health?.integrityProblem && (
                    <li className="text-xs text-red-500">Integritätsfehler: {health.integrityCount}</li>
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
