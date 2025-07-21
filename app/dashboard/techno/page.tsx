"use client"

import { useStationData } from "@/hooks/useStationData"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Volume2, TrendingUp, Clock, BarChart3, Download, Wind, AlertTriangle, Table as TableIcon } from "lucide-react"
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

export default function TechnoPage() {
  const [chartInterval, setChartInterval] = useState<"24h" | "7d">("24h")
  const [granularity, setGranularity] = useState<"1h" | "15min" | "10min" | "5min" | "1min">("15min")
  const data = useStationData("techno", chartInterval, granularity)
  const [config, setConfig] = useState<any>(null)
  useEffect(() => {
    fetch('/api/admin/config').then(res => res.json()).then(setConfig)
  }, [])
  // Compose KPIs from data (e.g., current, avg24h, max24h, min24h, violations, trend)
  const current = data.length > 0 ? data[data.length - 1].las : 0
  const max24h = data.length > 0 ? Math.max(...data.map(d => d.las)) : 0
  // const violations = data.length > 0 ? data.filter(d => d.las >= 60).length : 0
  const currentWind = data.length > 0 ? data[data.length - 1].ws : 0
  const windDirection = data.length > 0 ? data[data.length - 1].wd : "N/A"
  const avg24h = data.length > 0 ? (data.reduce((a, b) => a + b.las, 0) / data.length).toFixed(1) : 0
  // const min24h = data.length > 0 ? Math.min(...data.map(d => d.las)) : 0
  const trend = data.length > 1 ? ((data[data.length - 1].las - data[data.length - 2].las) / data[data.length - 2].las * 100).toFixed(1) : 0

  const now = data.length > 0 ? data[data.length - 1].datetime?.slice(11,16) : undefined
  const thresholds = config && now ? getThresholdsForStationAndTime(config, 'techno', now) : { warning: 55, alarm: 60, las: 50, laf: 52 }
  // Alert-Status und -Text bestimmen
  let alertStatus: 'normal' | 'warn' | 'alarm' = 'normal'
  if (current >= thresholds.alarm) alertStatus = 'alarm'
  else if (current >= thresholds.warning) alertStatus = 'warn'
  // Alert-Farben und Texte
  const alertConfig = {
    normal: {
      bg: 'from-pink-500/10 to-pink-600/10 border-pink-500/20',
      icon: <AlertTriangle className="w-4 lg:w-5 h-4 lg:h-5 text-pink-400" />,
      title: 'Lärmpegel im Normalbereich',
      text: `Aktueller Pegel: ${current.toFixed(1)} dB. Keine Grenzwertüberschreitung.`,
      textColor: 'text-pink-400',
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
    return "text-pink-400"
  }

  // Bestimmt das Status-Badge basierend auf dem Lärmpegel
  const getStatusBadge = (level: number) => {
    if (level >= thresholds.alarm) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge>
    if (level >= thresholds.warning) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge>
    return <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30">Normal</Badge>
  }

  // Vor dem Chart-Rendering:
  const warningLine = data.map(() => thresholds.warning)
  const alarmLine = data.map(() => thresholds.alarm)

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
            <div className="w-8 lg:w-10 h-8 lg:h-10 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center">
              <Volume2 className="w-4 lg:w-5 h-4 lg:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-pink-600 dark:text-white">Techno Floor</h1>
              <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">
                Techno Floor mit Wetter-Einfluss-Analyse
              </p>
            </div>
          </div>
          {/* Entferne den Status-Badge Tooltip */}
          <div className="flex items-center space-x-2">
            <div>{getStatusBadge(current)}</div>
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl min-h-[7rem] cursor-help">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                  Aktueller Pegel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-3 lg:w-4 h-3 lg:h-4 text-pink-400" />
                  <span className={`text-lg lg:text-2xl font-bold ${getStatusColor(current)}`}>{current.toFixed(1)}</span>
                  <span className="text-xs lg:text-sm text-gray-500">dB</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {current >= thresholds.alarm ? "Alarm" : current >= thresholds.warning ? "Warnung" : "Normal"}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          {/* 24h Durchschnitt */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl min-h-[7rem] cursor-help">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                  24h Durchschnitt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-3 lg:w-4 h-3 lg:h-4 text-pink-400" />
                  <span className="text-lg lg:text-2xl font-bold text-pink-400">{avg24h}</span>
                  <span className="text-xs lg:text-sm text-gray-500">dB</span>
                </div>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-2 lg:w-3 h-2 lg:h-3 text-pink-400 mr-1" />
                  <span className="text-xs text-pink-400">{Number(trend) > 0 ? "+" : ""}{trend}% vs gestern</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          {/* 24h Spitze */}
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
          {/* Windgeschwindigkeit */}
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
                <Link href="/dashboard/techno/table">
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
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold mr-2">Zeitraum:</span>
                {/* Entferne Tooltips von Chart-Buttons - sie sind selbsterklärend */}
                <Button variant={chartInterval === "24h" ? "default" : "outline"} size="sm" onClick={() => setChartInterval("24h")}>24h</Button>
                <Button variant={chartInterval === "7d" ? "default" : "outline"} size="sm" onClick={() => setChartInterval("7d")}>7d</Button>
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
            <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
              <Volume2 className="w-4 lg:w-5 h-4 lg:h-5 text-pink-400" />
              <span className="text-pink-600 dark:text-white">Techno Floor - Lärm- & Windanalyse</span>
            </CardTitle>
            <CardDescription className="text-xs lg:text-sm">
              Echtzeit-Überwachung mit Windgeschwindigkeits-Korrelation und Schwellenwert-Indikatoren
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 md:h-64 lg:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <defs>
                    <linearGradient id="colorTechno" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
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
                    domain={[30, 85]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} // Dynamische Farbe
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis
                    yAxisId="wind"
                    orientation="right"
                    domain={[0, 25]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} // Dynamische Farbe
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))", // Dynamische Farbe
                      border: "1px solid hsl(var(--border))", // Dynamische Farbe
                      borderRadius: "12px",
                      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
                      color: "hsl(var(--card-foreground))", // Dynamische Farbe
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
                    stroke={STATION_COLORS.techno.primary}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorTechno)"
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
                  {/* Grenzwertlinien */}
                  <Line yAxisId="noise" type="monotone" dataKey="warningLine" data={warningLine} stroke={CHART_COLORS.warning} strokeWidth={1} strokeDasharray="3 3" dot={false} name="Warnung" />
                  <Line yAxisId="noise" type="monotone" dataKey="alarmLine" data={alarmLine} stroke={CHART_COLORS.alarm} strokeWidth={1} strokeDasharray="3 3" dot={false} name="Alarm" />
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
