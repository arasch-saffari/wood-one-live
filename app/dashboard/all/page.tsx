"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, Wind, AlertTriangle, Table as TableIcon, Activity, Droplets, Thermometer } from "lucide-react"
import { useStationData } from "@/hooks/useStationData"
import { useEffect, useState } from "react"
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

// Hilfsfunktion: Windrichtung (Grad oder Abkürzung) in ausgeschriebenen Text umwandeln
function windDirectionText(dir: number | string | null | undefined): string {
  if (dir === null || dir === undefined) return '–';
  let deg = typeof dir === 'string' ? parseFloat(dir) : dir;
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

// Typen für Schwellenwerte und Daten
interface ThresholdBlock {
  from: string;
  to: string;
  warning: number;
  alarm: number;
  las?: number;
  laf?: number;
}

interface StationDataObj {
  data: Array<{ time: string; las: number; ws?: number; rh?: number; temp?: number; datetime?: string }>
  totalCount?: number
  loading?: boolean
  error?: string | null
}

interface Config {
  defaultInterval?: string
  defaultGranularity?: string
  chartLimit?: number
  chartColors?: { wind?: string }
  thresholdsByStationAndTime?: Record<string, ThresholdBlock[]>
}

// Definiere formatTime lokal:
function formatTime(latest: string | undefined) {
  if (!latest) return "-"
  const date = new Date(latest)
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " Uhr"
}

export default function AllLocationsPage() {
  // 1. Context und State
  const { config } = useConfig();
  const [chartInterval] = useState<string | undefined>(config?.defaultInterval)
  const [granularity] = useState<string | undefined>(config?.defaultGranularity)
  const [maxPoints, setMaxPoints] = useState<number>(0)

  // 2. Daten-Hooks
  const ortDataObj: StationDataObj = useStationData("ort", chartInterval as "24h" | "7d" | undefined, granularity as any, 1, maxPoints)
  const heuballernDataObj: StationDataObj = useStationData("heuballern", chartInterval as "24h" | "7d" | undefined, granularity as any, 1, maxPoints)
  const technoDataObj: StationDataObj = useStationData("techno", chartInterval as "24h" | "7d" | undefined, granularity as any, 1, maxPoints)
  const bandDataObj: StationDataObj = useStationData("band", chartInterval as "24h" | "7d" | undefined, granularity as any, 1, maxPoints)
  const ortData = ortDataObj.data ?? []
  const heuballernData = heuballernDataObj.data ?? []
  const technoData = technoDataObj.data ?? []
  const bandData = bandDataObj.data ?? []
  const { weather: latestWeather } = useWeatherData("global", "now")
  const weatherLastUpdate = useWeatherLastUpdate();
  const { health } = useHealth();
  const { watcherStatus: watcher } = useCsvWatcherStatus();

  // 3. Early-Return für Config
  if (!config) return <div className="flex items-center justify-center min-h-[300px] text-gray-400 text-sm">Lade Konfiguration ...</div>;
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
    const ort = ortData.find((d: { time: string }) => d.time === time)
    const techno = technoData.find((d: { time: string }) => d.time === time)
    const band = bandData.find((d: { time: string }) => d.time === time)
    const heuballern = heuballernData.find((d: { time: string }) => d.time === time)
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
  const getThresholds = (station: string, data: Array<{ datetime?: string }>): ThresholdBlock | undefined => {
    const now = data.length > 0 ? data[data.length - 1].datetime?.slice(11,16) : undefined
    if (!config || !now) return undefined;
    const blocks = config.thresholdsByStationAndTime?.[station];
    if (!blocks) return undefined;
    const currentBlock = blocks.find((block: ThresholdBlock) => {
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
  const filteredChartData = maxPoints > 0 && chartData.length > maxPoints ? chartData.slice(-maxPoints) : chartData

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
  const axes = [
    { id: 'left', orientation: 'left', domain: [30, 85], label: 'dB' },
    { id: 'wind', orientation: 'right', domain: [0, 25], label: 'km/h' },
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {Object.entries(currentLevels).map(([location, level]) => {
            const meta = STATION_META[location as keyof typeof STATION_META]
            return (
              <motion.div key={location}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {/* Link zu spezifischem Standort Dashboard */}
                <Link href={`/dashboard/${location}`}>
                  <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl transition-all duration-200 cursor-pointer hover:scale-105">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                          {meta.name}
                        </CardTitle>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <div>{getStatusBadge(level, location, ortData)}</div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Status: {level.toFixed(1)} dB</p>
                            <p className="text-xs text-muted-foreground">Klicken für Details</p>
                          </TooltipContent>
                        </UITooltip>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <meta.icon className={`w-4 h-4 text-${meta.kpiColor}`} />
                        <span className={`text-xl lg:text-2xl font-bold ${getStatusColor(level, location, ortData)}`}>{level.toFixed(1)}</span>
                        <span className="text-xs lg:text-sm text-gray-500">dB</span>
                      </div>
                      {/* Klick-Hinweis */}
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Klicken für Details →</div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )})}
        </div>

        {/* Wetter-Übersicht Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
                <Wind className="w-4 lg:w-5 h-4 lg:h-5 text-blue-400" />
                <span className="text-gray-900 dark:text-white">Wetter – aktuellster Wert</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Wind className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Windgeschwindigkeit</span>
                  </div>
                  <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">
                    {latestWeather?.windSpeed !== undefined ? latestWeather.windSpeed.toFixed(1) : '–'}
                  </div>
                  <div className="text-xs lg:text-sm text-gray-500">km/h</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Windrichtung</span>
                  </div>
                  <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">
                    {windDirectionText(latestWeather?.windDir)}
                  </div>
                  <div className="text-xs lg:text-sm text-gray-500">aktuell</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Droplets className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Luftfeuchtigkeit</span>
                  </div>
                  <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">
                    {latestWeather?.relHumidity !== undefined ? latestWeather.relHumidity.toFixed(0) : '–'}%
                  </div>
                  <div className="text-xs lg:text-sm text-gray-500">aktuell</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Thermometer className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Temperatur</span>
                  </div>
                  <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">
                    {typeof latestWeather?.temperature === 'number' ? Math.round(latestWeather.temperature) : '–'}°C
                  </div>
                  <div className="text-xs lg:text-sm text-gray-500">aktuell</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Nach System Status Card, vor Grenzwert-Referenz: */}
        {(ortData.length > 0 || heuballernData.length > 0 || technoData.length > 0 || bandData.length > 0) ? (
          <ChartPlayground
            data={filteredChartData}
            lines={[
              { key: 'ort', label: STATION_META.ort.name, color: STATION_META.ort.chartColor },
              { key: 'heuballern', label: STATION_META.heuballern.name, color: STATION_META.heuballern.chartColor },
              { key: 'techno', label: STATION_META.techno.name, color: STATION_META.techno.chartColor },
              { key: 'band', label: STATION_META.band.name, color: STATION_META.band.chartColor },
              { key: 'windSpeed', label: 'Windgeschwindigkeit', color: WIND_COLOR, yAxisId: 'wind', strokeDasharray: '5 5' },
            ]}
            axes={[
              { id: 'left', orientation: 'left', domain: [30, 85], label: 'dB' },
              { id: 'wind', orientation: 'right', domain: [0, 25], label: 'km/h' },
            ]}
            title="Alle Standorte"
            icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
            maxPoints={maxPoints}
            onMaxPointsChange={setMaxPoints}
          />
        ) : (
          <div className="flex items-center justify-center min-h-[300px] text-gray-400 text-sm">Lade Daten ...</div>
        )}

        {/* Grenzwert-Referenz */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
                <AlertTriangle className="w-4 lg:w-5 h-4 lg:h-5 text-yellow-400" />
                <span className="text-gray-900 dark:text-white">Grenzwert-Referenz</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {config && Object.entries(config.thresholdsByStationAndTime).map(([station, blocks]) => (
                  <Card key={station} className="bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 shadow-md">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm lg:text-base">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{station.charAt(0).toUpperCase() + station.slice(1)}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(blocks as ThresholdBlock[]).map((block: ThresholdBlock, i: number) => (
                        <div key={i} className="border-b border-gray-100 dark:border-gray-800 pb-2 mb-2 last:mb-0 last:pb-0 last:border-b-0">
                          <div className="text-xs text-gray-500 mb-1">
                            {block.from} - {block.to}
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                            <span className="text-gray-600 dark:text-gray-400 text-xs lg:text-sm">
                              Warnung: ≥ {block.warning} dB
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                            <span className="text-gray-600 dark:text-gray-400 text-xs lg:text-sm">
                              Alarm: ≥ {block.alarm} dB
                            </span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 1. Systemstatus-Block ans Ende verschieben und erweitern */}
        <motion.div>
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Systemstatus
              </CardTitle>
              <CardDescription>Übersicht: Messstationen, Wetter, Backups & System</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Stationen-Status */}
                <div>
                  <div className="font-semibold mb-2 flex items-center gap-2"><Droplets className="w-4 h-4 text-emerald-500" />Letzte Aktualisierung</div>
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
                  <div className="text-xs mt-2">Letztes Wetter-Update: {weatherLastUpdate?.time ?? '-'}</div>
                </div>
                {/* 2. Wetter & Backup */}
                <div>
                  <div className="font-semibold mb-2 flex items-center gap-2"><Droplets className="w-4 h-4 text-cyan-500" />Wetter & Backup</div>
                  <ul className="text-xs space-y-1">
                    <li>Letztes Backup: <span className="font-mono">{backupInfo?.lastBackup ? new Date(backupInfo.lastBackup).toLocaleString('de-DE') : '-'}</span></li>
                    <li>CSV-Watcher: <span className={cn('font-mono', watcher?.watcherActive ? 'text-green-600' : 'text-red-500')}>{watcher?.watcherActive ? 'Aktiv' : 'Inaktiv'}</span></li>
                    <li>CSV-Ordner: <span className="font-mono">{watcher?.watchedDirectories?.map((d: any) => d.station).join(', ')}</span></li>
                  </ul>
                </div>
                {/* 3. Systeminfos */}
                <div>
                  <div className="font-semibold mb-2 flex items-center gap-2"><TableIcon className="w-4 h-4 text-violet-500" />System</div>
                  <ul className="text-xs space-y-1">
                    <li>Datenbankgröße: <span className="font-mono">{health?.dbSize ? (health.dbSize / 1024 / 1024).toFixed(2) : '-'} MB</span></li>
                    <li>Health-Status: <span className={health?.integrityProblem ? 'text-red-500 font-bold' : 'text-green-600 font-semibold'}>{health?.integrityProblem ? 'Fehlerhaft' : 'OK'}</span></li>
                    {health?.integrityProblem && (
                      <li className="text-xs text-red-500">Integritätsfehler: {health.integrityCount}</li>
                    )}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </TooltipProvider>
  )
}
