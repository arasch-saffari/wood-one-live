"use client"

import { useStationData } from "@/hooks/useStationData"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, TrendingUp, Volume2, Clock, BarChart3, Download, Wind, AlertTriangle, Table as TableIcon } from "lucide-react"
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from "recharts"
import { useState } from "react"
import Link from "next/link"
import { STATION_COLORS, CHART_COLORS } from "@/lib/colors"
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getThresholdsForStationAndTime } from '@/lib/utils'
import { useEffect } from 'react'

export default function HeuballernPage() {
  const [chartInterval, setChartInterval] = useState<"24h" | "7d">("24h")
  const [granularity, setGranularity] = useState<"1h" | "15min" | "10min" | "5min" | "1min">("15min")
  const data = useStationData("heuballern", chartInterval, granularity)
  const current = data.length > 0 ? data[data.length - 1].las : 0
  const avg24h = data.length > 0 ? (data.reduce((a, b) => a + b.las, 0) / data.length).toFixed(1) : 0
  const max24h = data.length > 0 ? Math.max(...data.map(d => d.las)) : 0
  // const min24h = data.length > 0 ? Math.min(...data.map(d => d.las)) : 0
  // const violations = data.length > 0 ? data.filter(d => d.las >= 60).length : 0
  const trend = data.length > 1 ? ((data[data.length - 1].las - data[data.length - 2].las) / data[data.length - 2].las * 100).toFixed(1) : 0
  const currentWind = data.length > 0 ? data[data.length - 1].ws : 0
  const windDirection = data.length > 0 ? data[data.length - 1].wd : "N/A"

  const [config, setConfig] = useState<any>(null)
  useEffect(() => {
    fetch('/api/admin/config').then(res => res.json()).then(setConfig)
  }, [])

  const now = data.length > 0 ? data[data.length - 1].datetime?.slice(11,16) : undefined
  const thresholds = config && now ? getThresholdsForStationAndTime(config, 'heuballern', now) : { warning: 55, alarm: 60, las: 50, laf: 52 }
  let alertStatus: 'normal' | 'warn' | 'alarm' = 'normal'
  if (current >= thresholds.alarm) alertStatus = 'alarm'
  else if (current >= thresholds.warning) alertStatus = 'warn'
  const alertConfig = {
    normal: {
      bg: 'from-cyan-500/10 to-cyan-600/10 border-cyan-500/20',
      icon: <AlertTriangle className="w-4 lg:w-5 h-4 lg:h-5 text-cyan-400" />,
      title: 'Lärmpegel im Normalbereich',
      text: `Aktueller Pegel: ${current.toFixed(1)} dB. Keine Grenzwertüberschreitung.`,
      textColor: 'text-cyan-400',
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

  const getStatusColor = (level: number) => {
    if (level >= thresholds.alarm) return "text-red-400"
    if (level >= thresholds.warning) return "text-yellow-400"
    return "text-cyan-400"
  }

  // Bestimmt das Status-Badge basierend auf dem Lärmpegel
  const getStatusBadge = (level: number) => {
    if (level >= thresholds.alarm) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge>
    if (level >= thresholds.warning) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge>
    return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Normal</Badge>
  }

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
            <div className="w-8 lg:w-10 h-8 lg:h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center">
              <MapPin className="w-4 lg:w-5 h-4 lg:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-cyan-600 dark:text-white">Heuballern</h1>
              <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">
                Heuballern Floor mit Wetter-Einfluss-Analyse
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <UITooltip>
              <TooltipTrigger asChild>
                <div>{getStatusBadge(current)}</div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Status basierend auf aktuellem Lärmpegel</p>
                <p className="text-xs text-muted-foreground">≥60dB: Alarm, ≥55dB: Warnung, &lt;55dB: Normal</p>
              </TooltipContent>
            </UITooltip>
          </div>
        </motion.div>

        {/* Alert Banner immer anzeigen */}
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

        {/* KPI Karten */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {/* Aktueller Pegel */}
          <UITooltip>
            <TooltipTrigger asChild>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl min-h-[7rem] cursor-help">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                      Aktueller Pegel
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2">
                      <Volume2 className="w-3 lg:w-4 h-3 lg:h-4 text-cyan-400" />
                      <span className={`text-lg lg:text-2xl font-bold ${getStatusColor(current)}`}>{current.toFixed(1)}</span>
                      <span className="text-xs lg:text-sm text-gray-500">dB</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {current >= thresholds.alarm ? "Alarm" : current >= thresholds.warning ? "Warnung" : "Normal"}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Momentaner Lärmpegel am Standort</p>
              <p className="text-xs text-muted-foreground">Letzte Messung: {data.length > 0 ? data[data.length - 1].time : "N/A"}</p>
            </TooltipContent>
          </UITooltip>
          {/* 24h Durchschnitt */}
          <UITooltip>
            <TooltipTrigger asChild>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl min-h-[7rem] cursor-help">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                      24h Durchschnitt
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2">
                      <Volume2 className="w-3 lg:w-4 h-3 lg:h-4 text-cyan-400" />
                      <span className="text-lg lg:text-2xl font-bold text-cyan-400">{avg24h}</span>
                      <span className="text-xs lg:text-sm text-gray-500">dB</span>
                    </div>
                    <div className="flex items-center mt-1">
                      <TrendingUp className="w-2 lg:w-3 h-2 lg:h-3 text-cyan-400 mr-1" />
                      <span className="text-xs text-cyan-400">{Number(trend) > 0 ? "+" : ""}{trend}% vs gestern</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Durchschnittlicher Lärmpegel der letzten 24 Stunden</p>
              <p className="text-xs text-muted-foreground">Trend zeigt Änderung zum Vortag</p>
            </TooltipContent>
          </UITooltip>
          {/* 24h Spitze */}
          <UITooltip>
            <TooltipTrigger asChild>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl min-h-[7rem] cursor-help">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                      24h Spitze
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-3 lg:w-4 h-3 lg:h-4 text-red-400" />
                      <span className="text-lg lg:text-2xl font-bold text-red-400">{max24h.toFixed(1)}</span>
                      <span className="text-xs lg:text-sm text-gray-500">dB</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">um 23:15 Uhr</div>
                  </CardContent>
                </Card>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Höchster gemessener Lärmpegel der letzten 24 Stunden</p>
              <p className="text-xs text-muted-foreground">Zeitpunkt der Spitzenmessung</p>
            </TooltipContent>
          </UITooltip>
          {/* Windgeschwindigkeit */}
          <UITooltip>
            <TooltipTrigger asChild>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl min-h-[7rem] cursor-help">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                      Windgeschwindigkeit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2">
                      <Wind className="w-3 lg:w-4 h-3 lg:h-4 text-purple-400" />
                      <span className="text-lg lg:text-2xl font-bold text-purple-400">{currentWind ? currentWind : "N/A"}</span>
                      <span className="text-xs lg:text-sm text-gray-500">km/h</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Windrichtung: {windDirection}</div>
                  </CardContent>
                </Card>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Aktuelle Windgeschwindigkeit am Standort</p>
              <p className="text-xs text-muted-foreground">Wind kann Lärmpegel beeinflussen</p>
            </TooltipContent>
          </UITooltip>
        </div>

        {/* Tabellenansicht-Button */}
        <div className="flex justify-end mb-4">
          <UITooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 bg-transparent"
              >
                <Link href="/dashboard/heuballern/table">
                  <TableIcon className="w-4 h-4 mr-2" /> Tabellenansicht
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Detaillierte Datenansicht in Tabellenform</p>
            </TooltipContent>
          </UITooltip>
        </div>

      {/* Haupt-Diagramm */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold mr-2">Zeitraum:</span>
                <UITooltip><TooltipTrigger asChild><Button variant={chartInterval === "24h" ? "default" : "outline"} size="sm" onClick={() => setChartInterval("24h")}>24h</Button></TooltipTrigger><TooltipContent><p>Letzte 24 Stunden</p></TooltipContent></UITooltip>
                <UITooltip><TooltipTrigger asChild><Button variant={chartInterval === "7d" ? "default" : "outline"} size="sm" onClick={() => setChartInterval("7d")}>7d</Button></TooltipTrigger><TooltipContent><p>Letzte 7 Tage</p></TooltipContent></UITooltip>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto md:gap-2 md:overflow-visible pb-2 md:pb-0">
                <span className="text-xs font-semibold mr-2 shrink-0">Granularität:</span>
                <div className="flex flex-row gap-2 min-w-max">
                  <UITooltip><TooltipTrigger asChild><Button variant={granularity === "1h" ? "default" : "outline"} size="sm" onClick={() => setGranularity("1h")}>1h</Button></TooltipTrigger><TooltipContent><p>Stundenmittelwert</p></TooltipContent></UITooltip>
                  <UITooltip><TooltipTrigger asChild><Button variant={granularity === "15min" ? "default" : "outline"} size="sm" onClick={() => setGranularity("15min")}>15min</Button></TooltipTrigger><TooltipContent><p>15-Minuten-Mittelwert</p></TooltipContent></UITooltip>
                  <UITooltip><TooltipTrigger asChild><Button variant={granularity === "10min" ? "default" : "outline"} size="sm" onClick={() => setGranularity("10min")}>10min</Button></TooltipTrigger><TooltipContent><p>10-Minuten-Mittelwert</p></TooltipContent></UITooltip>
                  <UITooltip><TooltipTrigger asChild><Button variant={granularity === "5min" ? "default" : "outline"} size="sm" onClick={() => setGranularity("5min")}>5min</Button></TooltipTrigger><TooltipContent><p>5-Minuten-Mittelwert</p></TooltipContent></UITooltip>
                  <UITooltip><TooltipTrigger asChild><Button variant={granularity === "1min" ? "default" : "outline"} size="sm" onClick={() => setGranularity("1min")}>1min</Button></TooltipTrigger><TooltipContent><p>1-Minuten-Wert</p></TooltipContent></UITooltip>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-48 md:h-64 lg:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <defs>
                    <linearGradient id="colorHeuballern" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis
                    yAxisId="noise"
                    domain={[30, 85]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis
                    yAxisId="wind"
                    orientation="right"
                    domain={[0, 25]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
                      color: "hsl(var(--card-foreground))",
                    }}
                    formatter={(value: number, name: string): [string, string] => {
                      if (name === "las") return [`${value.toFixed(1)} dB`, "Lärmpegel"]
                      if (name === "ws") return [`${value.toFixed(1)} km/h`, "Windgeschwindigkeit"]
                      if (name === "rh") return [`${value.toFixed(0)} %`, "Luftfeuchtigkeit"]
                      return [String(value), name]
                    }}
                  />
                  <Area
                    yAxisId="noise"
                    type="monotone"
                    dataKey="las"
                    stroke={STATION_COLORS.heuballern.primary}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorHeuballern)"
                  />
                  <Line
                    yAxisId="wind"
                    type="monotone"
                    dataKey="ws"
                    stroke={CHART_COLORS.wind}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Windgeschwindigkeit"
                  />
                  <Line
                    yAxisId="wind"
                    type="monotone"
                    dataKey="rh"
                    stroke={CHART_COLORS.humidity}
                    strokeWidth={2}
                    strokeDasharray="2 2"
                    dot={false}
                    name="Luftfeuchtigkeit"
                  />
                  <Line
                    yAxisId="noise"
                    type="monotone"
                    dataKey={() => thresholds.warning}
                    stroke={CHART_COLORS.warning}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    name="Warnung"
                  />
                  <Line
                    yAxisId="noise"
                    type="monotone"
                    dataKey={() => thresholds.alarm}
                    stroke={CHART_COLORS.alarm}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    name="Alarm"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
    </TooltipProvider>
  )
}
