"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, TrendingUp, Volume2, Wind, Download, BarChart3 } from "lucide-react"
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area } from "recharts"

// Generiert detaillierte Mock-Daten für den Standort "Heuballern"
const generateFloorData = () => {
  const now = new Date()
  const data = []

  for (let i = 0; i < 96; i++) {
    const timestamp = new Date(now.getTime() - (95 - i) * 15 * 60 * 1000)
    const hour = timestamp.getHours()

    // Heuballern - landwirtschaftliche Fläche, ruhiger
    let baseLevel = 38
    if (hour >= 6 && hour <= 8)
      baseLevel = 42 // Morgenaktivität
    else if (hour >= 17 && hour <= 19)
      baseLevel = 44 // Abendaktivität
    else if (hour >= 22 || hour <= 6) baseLevel = 32 // Nachtruhe

    const windSpeed = 8 + Math.random() * 12 // 8-20 km/h
    const windDirection = Math.floor(Math.random() * 360)
    const variation = Math.random() * 6 - 3
    const windInfluence = windSpeed > 15 ? 2 : 0 // Wind erhöht Lärm leicht

    const level = Math.max(28, baseLevel + variation + windInfluence)

    data.push({
      time: timestamp.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      timestamp: timestamp.getTime(),
      level: level,
      windSpeed: windSpeed,
      windDirection: windDirection,
      date: timestamp.toLocaleDateString("de-DE"),
    })
  }

  return data
}

// Generiert KPI-Werte für den Standort "Heuballern"
const getKPIs = () => ({
  current: 39.2,
  avg24h: 37.8,
  max24h: 46.1,
  min24h: 29.3,
  violations: 1,
  trend: -1.2,
  currentWind: 12.4,
  windDirection: "SW",
})

export default function HeuballernPage() {
  const [data, setData] = useState(generateFloorData())
  const [kpis, setKpis] = useState(getKPIs())

  // Aktualisiert Daten und KPIs in Intervallen
  useEffect(() => {
    const interval = setInterval(() => {
      setData(generateFloorData())
      setKpis(getKPIs())
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  // Bestimmt die Statusfarbe basierend auf dem Lärmpegel
  const getStatusColor = (level: number) => {
    if (level >= 60) return "text-red-400"
    if (level >= 55) return "text-yellow-400"
    return "text-cyan-400"
  }

  return (
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
            <h1 className="text-xl lg:text-2xl font-bold text-white dark:text-white text-gray-900">Heuballern</h1>
            <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">
              Landwirtschaftliche Flächenüberwachung mit Wetterkorrelation
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 bg-transparent"
          >
            <Download className="w-3 lg:w-4 h-3 lg:h-4 mr-2" />
            Daten Exportieren
          </Button>
        </div>
      </motion.div>

      {/* KPI Karten */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                Aktueller Pegel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Volume2 className="w-3 lg:w-4 h-3 lg:h-4 text-cyan-400" />
                <span className={`text-lg lg:text-2xl font-bold ${getStatusColor(kpis.current)}`}>
                  {kpis.current.toFixed(1)}
                </span>
                <span className="text-xs lg:text-sm text-gray-500">dB</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                24h Durchschnitt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-3 lg:w-4 h-3 lg:h-4 text-cyan-400" />
                <span className="text-lg lg:text-2xl font-bold text-cyan-400">{kpis.avg24h.toFixed(1)}</span>
                <span className="text-xs lg:text-sm text-gray-500">dB</span>
              </div>
              <div className="flex items-center mt-1">
                <TrendingUp className="w-2 lg:w-3 h-2 lg:h-3 text-emerald-400 mr-1" />
                <span className="text-xs text-emerald-400">{kpis.trend}% vs gestern</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                Windgeschwindigkeit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Wind className="w-3 lg:w-4 h-3 lg:h-4 text-pink-400" />
                <span className="text-lg lg:text-2xl font-bold text-pink-400">{kpis.currentWind}</span>
                <span className="text-xs lg:text-sm text-gray-500">km/h</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Richtung: {kpis.windDirection}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                Verletzungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <span className="text-lg lg:text-2xl font-bold text-emerald-400">{kpis.violations}</span>
                <span className="text-xs lg:text-sm text-gray-500">heute</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Letzte: vor 4h</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Haupt-Diagramm mit Windkorrelation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
              <BarChart3 className="w-4 lg:w-5 h-4 lg:h-5 text-cyan-400" />
              <span className="text-gray-900 dark:text-white">Heuballern - Lärm- & Windkorrelation</span>
            </CardTitle>
            <CardDescription className="text-xs lg:text-sm">
              15-Minuten-Intervalle zeigen Lärmpegel mit Windgeschwindigkeits-Overlay
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 lg:h-96">
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
                    domain={[25, 55]}
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
                    formatter={(value: any, name: string) => {
                      if (name === "level") return [`${value.toFixed(1)} dB`, "Lärmpegel"]
                      if (name === "windSpeed") return [`${value.toFixed(1)} km/h`, "Windgeschwindigkeit"]
                      return [value, name]
                    }}
                  />
                  <Area
                    yAxisId="noise"
                    type="monotone"
                    dataKey="level"
                    stroke="#06b6d4"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorHeuballern)"
                  />
                  <Line
                    yAxisId="wind"
                    type="monotone"
                    dataKey="windSpeed"
                    stroke="#ec4899"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Windgeschwindigkeit"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Windanalyse */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
              <Wind className="w-4 lg:w-5 h-4 lg:h-5 text-pink-400" />
              <span className="text-gray-900 dark:text-white">Wind-Einfluss-Analyse</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
              <div className="text-center">
                <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">+2.1 dB</div>
                <div className="text-xs lg:text-sm text-gray-500">Durchschn. Anstieg bei &gt;15 km/h Wind</div>
              </div>
              <div className="text-center">
                <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">SW</div>
                <div className="text-xs lg:text-sm text-gray-500">Dominante Windrichtung</div>
              </div>
              <div className="text-center">
                <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">0.73</div>
                <div className="text-xs lg:text-sm text-gray-500">Wind-Lärm-Korrelation</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
