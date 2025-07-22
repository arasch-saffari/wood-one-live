"use client"


import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, TrendingUp, Volume2, Clock, BarChart3, Download, Wind, AlertTriangle, Table as TableIcon } from "lucide-react"
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from "recharts"
import { useStationData } from "@/hooks/useStationData"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { STATION_COLORS, CHART_COLORS } from "@/lib/colors"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  TooltipProvider,
  Tooltip as UITooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { toast } from "@/components/ui/use-toast"

interface ThresholdBlock {
  from: string;
  to: string;
  warning: number;
  alarm: number;
  las: number;
  laf: number;
}
interface Config {
  thresholdsByStationAndTime: Record<string, ThresholdBlock[]>;
  apiCacheDuration?: number;
}

export default function OrtPage() {
  const [chartInterval, setChartInterval] = useState<"24h" | "7d">("24h")
  const [granularity, setGranularity] = useState<"15min" | "10min" | "5min" | "1min" | "1h">("15min")
  const { data: chartData } = useStationData("ort", chartInterval, granularity)
  const [config, setConfig] = useState<Config | null>(null)
  useEffect(() => {
    fetch('/api/admin/config')
      .then(res => {
        if (!res.ok) throw new Error('Fehler beim Laden der Konfiguration')
        return res.json()
      })
      .then(setConfig)
      .catch(() => {
        toast({
          title: 'Fehler',
          description: 'Konfiguration konnte nicht geladen werden.',
          variant: 'destructive',
        })
      })
  }, [])
  const [maxPoints, setMaxPoints] = useState<number>(200)
  const [zoomRange, setZoomRange] = useState<{start: number, end: number} | null>(null)
  const chartRef = useRef<any>(null)
  // Compose KPIs from data (e.g., current, avg24h, max24h, min24h, violations, trend)
  const current = chartData.length > 0 ? chartData[chartData.length - 1].las : 0
  const avg24h = chartData.length > 0 ? (chartData.reduce((a, b) => a + b.las, 0) / chartData.length).toFixed(1) : 0
  const max24h = chartData.length > 0 ? Math.max(...chartData.map(d => d.las)) : 0
  const min24h = chartData.length > 0 ? Math.min(...chartData.map(d => d.las)) : 0
  const violations = chartData.length > 0 ? chartData.filter(d => d.las > 60).length : 0
  const trend = chartData.length > 1 ? ((chartData[chartData.length - 1].las - chartData[chartData.length - 2].las) / chartData[chartData.length - 2].las * 100).toFixed(1) : 0
  const currentWind = chartData.length > 0 ? chartData[chartData.length - 1].ws : 0
  const windDirection = chartData.length > 0 ? chartData[chartData.length - 1].wd : "N/A"

  // Aktuelle Zeit und Schwellenwerte bestimmen
  const now = chartData.length > 0 ? chartData[chartData.length - 1].datetime?.slice(11,16) : undefined
  const thresholds = config && now ? { warning: 55, alarm: 60, las: 50, laf: 52 } : { warning: 55, alarm: 60, las: 50, laf: 52 }
  // Alert-Status und -Text bestimmen
  let alertStatus: 'normal' | 'warn' | 'alarm' = 'normal'
  if (current >= thresholds.alarm) alertStatus = 'alarm'
  else if (current >= thresholds.warning) alertStatus = 'warn'
  // Alert-Farben und Texte
  const alertConfig = {
    normal: {
      bg: 'from-emerald-500/10 to-emerald-600/10 border-emerald-500/20',
      icon: <AlertTriangle className="w-4 lg:w-5 h-4 lg:h-5 text-emerald-400" />,
      title: 'Lärmpegel im Normalbereich',
      text: `Aktueller Pegel: ${current.toFixed(1)} dB. Keine Grenzwertüberschreitung.`,
      textColor: 'text-emerald-400',
    },
    warn: {
      bg: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
      icon: <AlertTriangle className="w-4 lg:w-5 h-4 lg:h-5 text-yellow-400" />,
      title: 'Warnung: Lärmpegel erhöht',
      text: `Pegel liegt im Warnbereich (${current.toFixed(1)} dB). Windrichtung: ${windDirection} bei ${currentWind ? currentWind : "N/A"} km/h`,
      textColor: 'text-yellow-400',
    },
    alarm: {
      bg: 'from-red-500/20 to-red-600/20 border-red-500/30',
      icon: <AlertTriangle className="w-4 lg:w-5 h-4 lg:h-5 text-red-400" />,
      title: 'Alarm: Hoher Lärmpegel',
      text: `Pegel überschreitet Alarmgrenzwert (${current.toFixed(1)} dB). Windrichtung: ${windDirection} bei ${currentWind ? currentWind : "N/A"} km/h`,
      textColor: 'text-red-400',
    },
  }[alertStatus]

  // Bestimmt die Statusfarbe basierend auf dem Lärmpegel
  const getStatusColor = (level: number) => {
    if (level >= thresholds.alarm) return "text-red-400"
    if (level >= thresholds.warning) return "text-yellow-400"
    return "text-emerald-400"
  }

  // Bestimmt das Status-Badge basierend auf dem Lärmpegel
  const getStatusBadge = (level: number) => {
    if (level >= thresholds.alarm) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge>
    if (level >= thresholds.warning) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge>
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Normal</Badge>
  }

  // Chart-Daten filtern
  const filteredChartData = maxPoints > 0 && chartData.length > maxPoints ? chartData.slice(-maxPoints) : chartData
  // Zoom & Pan Bereich anwenden
  const visibleData = zoomRange ? filteredChartData.slice(zoomRange.start, zoomRange.end) : filteredChartData
  // Zoom/Pan Controls
  const canZoomIn = visibleData.length > 10
  const canZoomOut = !!zoomRange
  const handleZoomIn = () => {
    if (!zoomRange) setZoomRange({ start: Math.max(0, filteredChartData.length - 50), end: filteredChartData.length })
    else {
      const size = zoomRange.end - zoomRange.start
      if (size > 10) setZoomRange({ start: zoomRange.start + Math.floor(size/4), end: zoomRange.end - Math.floor(size/4) })
    }
  }
  const handleZoomOut = () => {
    setZoomRange(null)
  }
  const handlePanLeft = () => {
    if (!zoomRange) return
    const size = zoomRange.end - zoomRange.start
    setZoomRange({ start: Math.max(0, zoomRange.start - size/2), end: Math.max(size, zoomRange.end - size/2) })
  }
  const handlePanRight = () => {
    if (!zoomRange) return
    const size = zoomRange.end - zoomRange.start
    setZoomRange({ start: Math.min(filteredChartData.length - size, zoomRange.start + size/2), end: Math.min(filteredChartData.length, zoomRange.end + size/2) })
  }

  // 1. State für Sichtbarkeit der Datenreihen
  const [visibleLines, setVisibleLines] = useState({
    las: true,
    ws: true,
    rh: true,
    warning: true,
    alarm: true,
  })

  // 2. Handler für Toggle
  function toggleLine(key: keyof typeof visibleLines) {
    setVisibleLines(v => ({ ...v, [key]: !v[key] }))
  }

  // Dynamische Domain/Ticks für Wind-Achse berechnen
  const windValues = visibleData.map(d => typeof d.ws === 'number' ? d.ws : Number(d.ws)).filter(v => !isNaN(v))
  const minWind = windValues.length ? Math.floor(Math.min(...windValues, 0) / 5) * 5 : 0
  const maxWind = windValues.length ? Math.ceil(Math.max(...windValues, 25) / 5) * 5 : 25
  const windTicks = []
  for (let t = minWind; t <= maxWind; t += 5) windTicks.push(t)

  return (
    <TooltipProvider>
      <div className="space-y-4 lg:space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between space-y-3 lg:space-y-0"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 lg:w-10 h-8 lg:h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <MapPin className="w-4 lg:w-5 h-4 lg:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-emerald-600 dark:text-white">Standort Ort</h1>
              <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">
                Detaillierte Lärmüberwachung mit Windkorrelation
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <UITooltip>
              <TooltipTrigger asChild>
                <span>{getStatusBadge(current)}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Status basierend auf aktuellem Lärmpegel</p>
                <p className="text-xs text-muted-foreground">≥60dB: Alarm, ≥55dB: Warnung, &lt;55dB: Normal</p>
              </TooltipContent>
            </UITooltip>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className={`bg-gradient-to-r ${alertConfig.bg}`}>
            <CardContent className="py-4">
              <div className="flex items-center space-x-3">
                {alertConfig.icon}
                <div>
                  <p className={`font-medium ${alertConfig.textColor} text-sm lg:text-base`}>{alertConfig.title}</p>
                  <p className={`text-xs lg:text-sm ${alertConfig.textColor}`}>{alertConfig.text}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl min-h-[7rem]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                  Aktueller Pegel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-3 lg:w-4 h-3 lg:h-4 text-emerald-400" />
                  <span className={`text-lg lg:text-2xl font-bold ${getStatusColor(current)}`}>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{current.toFixed(1)}</span>
                      </TooltipTrigger>
                      <TooltipContent>Aktueller Lärmpegel in dB</TooltipContent>
                    </UITooltip>
                  </span>
                  <span className="text-xs lg:text-sm text-gray-500">dB</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {current >= thresholds.alarm ? "Alarm" : current >= thresholds.warning ? "Warnung" : "Normal"}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl min-h-[7rem]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                  24h Durchschnitt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-3 lg:w-4 h-3 lg:h-4 text-emerald-400" />
                  <span className="text-lg lg:text-2xl font-bold text-emerald-400">
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{avg24h}</span>
                      </TooltipTrigger>
                      <TooltipContent>24h Durchschnitt in dB</TooltipContent>
                    </UITooltip>
                  </span>
                  <span className="text-xs lg:text-sm text-gray-500">dB</span>
                </div>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-2 lg:w-3 h-2 lg:h-3 text-emerald-400 mr-1" />
                  <span className="text-xs text-emerald-400">{Number(trend) > 0 ? "+" : ""}{trend}% vs gestern</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl min-h-[7rem]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                  24h Spitze
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-3 lg:w-4 h-3 lg:h-4 text-red-400" />
                  <span className="text-lg lg:text-2xl font-bold text-red-400">
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{max24h.toFixed(1)}</span>
                      </TooltipTrigger>
                      <TooltipContent>24h Spitze in dB</TooltipContent>
                    </UITooltip>
                  </span>
                  <span className="text-xs lg:text-sm text-gray-500">dB</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">um 18:45 Uhr</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl min-h-[7rem]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                  Windgeschwindigkeit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Wind className="w-3 lg:w-4 h-3 lg:h-4 text-cyan-400" />
                  <span className="text-lg lg:text-2xl font-bold text-cyan-400">
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{currentWind != null ? currentWind : "keine daten"}</span>
                      </TooltipTrigger>
                      <TooltipContent>Windgeschwindigkeit in km/h</TooltipContent>
                    </UITooltip>
                  </span>
                  <span className="text-xs lg:text-sm text-gray-500">km/h</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">+1.5 dB Einfluss</div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        <div className="flex justify-end mb-4">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 bg-transparent"
          >
            <Link href="/dashboard/ort/table">
              <TableIcon className="w-4 h-4 mr-2" /> Tabellenansicht
            </Link>
          </Button>
        </div>
        {/* 1. Buttons zentriert über dem Chart */}
        <div className="flex justify-center gap-2 items-center my-4 flex-wrap">
          <UITooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={handlePanLeft} disabled={!zoomRange || zoomRange.start === 0} className="transition hover:bg-emerald-100 dark:hover:bg-emerald-900/30 active:scale-95">
                <span className="flex items-center gap-1">← <span className="hidden sm:inline">Links</span></span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Chart nach links schieben</TooltipContent>
          </UITooltip>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={handleZoomIn} disabled={visibleData.length <= 10} className="transition hover:bg-emerald-100 dark:hover:bg-emerald-900/30 active:scale-95">
                <span className="flex items-center gap-1">＋ <span className="hidden sm:inline">Hineinzoomen</span></span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>In das Chart hineinzoomen</TooltipContent>
          </UITooltip>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={handleZoomOut} disabled={!zoomRange} className="transition hover:bg-emerald-100 dark:hover:bg-emerald-900/30 active:scale-95">
                <span className="flex items-center gap-1">🗖 <span className="hidden sm:inline">Zoom zurücksetzen</span></span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom zurücksetzen</TooltipContent>
          </UITooltip>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={handlePanRight} disabled={!zoomRange || zoomRange.end === filteredChartData.length} className="transition hover:bg-emerald-100 dark:hover:bg-emerald-900/30 active:scale-95">
                <span className="flex items-center gap-1">→ <span className="hidden sm:inline">Rechts</span></span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Chart nach rechts schieben</TooltipContent>
          </UITooltip>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold mr-2">Zeitraum:</span>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Button variant={chartInterval === "24h" ? "default" : "outline"} size="sm" onClick={() => setChartInterval("24h")}>24h</Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Letzte 24 Stunden anzeigen</p>
                    </TooltipContent>
                  </UITooltip>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Button variant={chartInterval === "7d" ? "default" : "outline"} size="sm" onClick={() => setChartInterval("7d")}>7d</Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Letzte 7 Tage anzeigen</p>
                    </TooltipContent>
                  </UITooltip>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto md:gap-2 md:overflow-visible pb-2 md:pb-0">
                  <span className="text-xs font-semibold mr-2 shrink-0">Granularität:</span>
                  <div className="flex flex-row gap-2 min-w-max">
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Button variant={granularity === "1h" ? "default" : "outline"} size="sm" onClick={() => setGranularity("1h")}>1h</Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Stunden-Aufzeichnung</p>
                      </TooltipContent>
                    </UITooltip>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Button variant={granularity === "15min" ? "default" : "outline"} size="sm" onClick={() => setGranularity("15min")}>15min</Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Fünfzehn-Minuten-Aufzeichnung</p>
                      </TooltipContent>
                    </UITooltip>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Button variant={granularity === "10min" ? "default" : "outline"} size="sm" onClick={() => setGranularity("10min")}>10min</Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Zehn-Minuten-Aufzeichnung</p>
                      </TooltipContent>
                    </UITooltip>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Button variant={granularity === "5min" ? "default" : "outline"} size="sm" onClick={() => setGranularity("5min")}>5min</Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Fünf-Minuten-Aufzeichnung</p>
                      </TooltipContent>
                    </UITooltip>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Button variant={granularity === "1min" ? "default" : "outline"} size="sm" onClick={() => setGranularity("1min")}>1min</Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Ein-Minuten-Aufzeichnung</p>
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold mr-2">Anzahl Punkte:</span>
                    <Select value={String(maxPoints)} onValueChange={v => setMaxPoints(Number(v))}>
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                        <SelectItem value="0">Alle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-48 md:h-64 lg:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={visibleData} ref={chartRef}>
                    <defs>
                      <linearGradient id="colorOrt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))" // Dynamische Farbe
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} // Dynamische Farbe
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis
                      yAxisId="noise"
                      domain={[30, 95]}
                      ticks={[30, 40, 50, 60, 70, 80, 90]}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={{ stroke: "hsl(var(--border))" }}
                      label={{ value: 'Lärmpegel (dB)', angle: -90, position: 'insideLeft', offset: 0, style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))', fontSize: 12 } }}
                      allowDecimals={false}
                      type="number"
                      interval={0}
                    />
                    <YAxis
                      yAxisId="wind"
                      orientation="right"
                      domain={[minWind, maxWind]}
                      ticks={windTicks}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={{ stroke: "hsl(var(--border))" }}
                      label={{ value: 'Windgeschwindigkeit (km/h)', angle: 90, position: 'insideRight', offset: 0, style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))', fontSize: 12 } }}
                      allowDecimals={false}
                      type="number"
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                        color: "hsl(var(--card-foreground))",
                      }}
                      formatter={(value, name) => {
                        if (name === "ws") return [`${value} km/h`, "Windgeschwindigkeit"]
                        if (name === "rh") return [`${value} %`, "Luftfeuchte"]
                        if (name === "las") return [`${value} dB`, "Lärmpegel"]
                        if (name === "temp") return [`${value}°C`, "Temperatur"]
                        if (Number(value) === thresholds.warning) return [`${value} dB`, "Warnung (Grenzwert)"]
                        if (Number(value) === thresholds.alarm) return [`${value} dB`, "Alarm (Grenzwert)"]
                        if (!name) return [String(value), "Wert"]
                        return [String(value), name]
                      }}
                    />
                    {visibleLines.las && (
                      <Line
                        type="monotone"
                        dataKey="las"
                        stroke={STATION_COLORS.ort.primary}
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, fill: STATION_COLORS.ort.primary }}
                        yAxisId="noise"
                      />
                    )}
                    {visibleLines.ws && (
                      <Line
                        type="monotone"
                        dataKey="ws"
                        stroke={CHART_COLORS.wind}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={{ r: 4, fill: CHART_COLORS.wind }}
                        yAxisId="wind"
                      />
                    )}
                    {visibleLines.rh && (
                      <Line
                        type="monotone"
                        dataKey="rh"
                        stroke={CHART_COLORS.humidity}
                        strokeWidth={2}
                        strokeDasharray="2 2"
                        dot={false}
                        activeDot={{ r: 4, fill: CHART_COLORS.humidity }}
                        yAxisId="noise"
                      />
                    )}
                    {/* Grenzwertlinien */}
                    {visibleLines.warning && (
                      <Line
                        type="monotone"
                        dataKey={() => thresholds.warning}
                        stroke={CHART_COLORS.warning}
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        dot={false}
                        activeDot={{ r: 3, fill: CHART_COLORS.warning }}
                        yAxisId="noise"
                      />
                    )}
                    {visibleLines.alarm && (
                      <Line
                        type="monotone"
                        dataKey={() => thresholds.alarm}
                        stroke={CHART_COLORS.alarm}
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        dot={false}
                        activeDot={{ r: 3, fill: CHART_COLORS.alarm }}
                        name="Alarm"
                        yAxisId="noise"
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 2. Interaktive Legende direkt unter dem Chart */}
        <div className="flex flex-wrap gap-4 mt-4 text-xs items-center justify-center">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={visibleLines.las} onChange={() => toggleLine('las')} className="accent-emerald-500" />
            <span className="w-3 h-3 rounded-full" style={{background: STATION_COLORS.ort.primary}}></span> Lärmpegel
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={visibleLines.ws} onChange={() => toggleLine('ws')} className="accent-cyan-500" />
            <span className="w-3 h-3 rounded-full" style={{background: CHART_COLORS.wind}}></span> Wind
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={visibleLines.rh} onChange={() => toggleLine('rh')} className="accent-blue-500" />
            <span className="w-3 h-3 rounded-full" style={{background: CHART_COLORS.humidity}}></span> Luftfeuchte
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={visibleLines.warning} onChange={() => toggleLine('warning')} className="accent-yellow-500" />
            <span className="w-3 h-3 rounded-full" style={{background: CHART_COLORS.warning}}></span> Warnung
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={visibleLines.alarm} onChange={() => toggleLine('alarm')} className="accent-red-500" />
            <span className="w-3 h-3 rounded-full" style={{background: CHART_COLORS.alarm}}></span> Alarm
          </label>
        </div>
      </div>
    </TooltipProvider>
  )
}
