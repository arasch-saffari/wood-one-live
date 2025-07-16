"use client"

import { cn } from "@/lib/utils"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, TrendingUp, Volume2, Clock, BarChart3, Download, Wind } from "lucide-react"
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from "recharts"

// Generiert detaillierte Mock-Daten für den Standort "Ort"
const generateDetailedData = () => {
  const now = new Date()
  const data = []

  for (let i = 0; i < 96; i++) {
    const timestamp = new Date(now.getTime() - (95 - i) * 15 * 60 * 1000)
    const hour = timestamp.getHours()

    // Simuliert realistische Lärmmuster für den Standort "Ort"
    let baseLevel = 40
    if (hour >= 6 && hour <= 8)
      baseLevel = 48 // Morgenverkehr
    else if (hour >= 12 && hour <= 14)
      baseLevel = 45 // Mittagsaktivität
    else if (hour >= 17 && hour <= 19)
      baseLevel = 47 // Abendverkehr
    else if (hour >= 22 || hour <= 6) baseLevel = 35 // Nachtruhe

    const windSpeed = 8 + Math.random() * 12
    const variation = Math.random() * 8 - 4
    const windInfluence = windSpeed > 15 ? 1.5 : 0
    const level = Math.max(30, baseLevel + variation + windInfluence)

    data.push({
      time: timestamp.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      timestamp: timestamp.getTime(),
      level: level,
      windSpeed: windSpeed,
      date: timestamp.toLocaleDateString("de-DE"),
    })
  }

  return data
}

// Generiert KPI-Werte für den Standort "Ort"
const getKPIs = () => ({
  current: 42.3,
  avg24h: 41.8,
  max24h: 56.2,
  min24h: 32.1,
  violations: 3,
  trend: 2.1,
  currentWind: 11.4,
})

export default function OrtPage() {
  const [data, setData] = useState(generateDetailedData())
  const [kpis, setKpis] = useState(getKPIs())
  const [timeRange, setTimeRange] = useState("24h")

  // Aktualisiert Daten und KPIs in Intervallen
  useEffect(() => {
    const interval = setInterval(() => {
      setData(generateDetailedData())
      setKpis(getKPIs())
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  // Bestimmt die Statusfarbe basierend auf dem Lärmpegel
  const getStatusColor = (level: number) => {
    if (level >= 60) return "text-red-400"
    if (level >= 55) return "text-yellow-400"
    return "text-emerald-400"
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
          <div className="w-8 lg:w-10 h-8 lg:h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <MapPin className="w-4 lg:w-5 h-4 lg:h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-white dark:text-white text-gray-900">Standort Ort</h1>
            <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">
              Detaillierte Lärmüberwachung mit Windkorrelation
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
                <Volume2 className="w-3 lg:w-4 h-3 lg:h-4 text-emerald-400" />
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
                <BarChart3 className="w-3 lg:w-4 h-3 lg:h-4 text-emerald-400" />
                <span className="text-lg lg:text-2xl font-bold text-emerald-400">{kpis.avg24h.toFixed(1)}</span>
                <span className="text-xs lg:text-sm text-gray-500">dB</span>
              </div>
              <div className="flex items-center mt-1">
                <TrendingUp className="w-2 lg:w-3 h-2 lg:h-3 text-emerald-400 mr-1" />
                <span className="text-xs text-emerald-400">+{kpis.trend}% vs gestern</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                24h Spitze
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-3 lg:w-4 h-3 lg:h-4 text-red-400" />
                <span className="text-lg lg:text-2xl font-bold text-red-400">{kpis.max24h.toFixed(1)}</span>
                <span className="text-xs lg:text-sm text-gray-500">dB</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">um 18:45 Uhr</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                Windgeschwindigkeit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Wind className="w-3 lg:w-4 h-3 lg:h-4 text-cyan-400" />
                <span className="text-lg lg:text-2xl font-bold text-cyan-400">{kpis.currentWind}</span>
                <span className="text-xs lg:text-sm text-gray-500">km/h</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">+1.5 dB Einfluss</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Haupt-Diagramm mit Windkorrelation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-2 lg:space-y-0">
              <div>
                <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
                  <BarChart3 className="w-4 lg:w-5 h-4 lg:h-5 text-emerald-400" />
                  <span className="text-gray-900 dark:text-white">Ort - Lärm- & Windkorrelation</span>
                </CardTitle>
                <CardDescription className="text-xs lg:text-sm">
                  15-Minuten-Intervalle mit Windgeschwindigkeits-Overlay
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant={timeRange === "24h" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeRange("24h")}
                  className={cn(
                    "text-xs lg:text-sm",
                    timeRange === "24h"
                      ? "bg-gradient-to-r from-pink-500 to-purple-600"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800",
                  )}
                >
                  24h
                </Button>
                <Button
                  variant={timeRange === "7d" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeRange("7d")}
                  className={cn(
                    "text-xs lg:text-sm",
                    timeRange === "7d"
                      ? "bg-gradient-to-r from-pink-500 to-purple-600"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800",
                  )}
                >
                  7d
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 lg:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
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
                    domain={[30, 70]}
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
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorOrt)"
                  />
                  <Line
                    yAxisId="wind"
                    type="monotone"
                    dataKey="windSpeed"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Windgeschwindigkeit"
                  />
                  {/* Grenzwertlinien */}
                  <Line
                    yAxisId="noise"
                    type="monotone"
                    dataKey={() => 55}
                    stroke="#facc15"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                  <Line
                    yAxisId="noise"
                    type="monotone"
                    dataKey={() => 60}
                    stroke="#f87171"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Statistiken */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
              <Clock className="w-4 lg:w-5 h-4 lg:h-5 text-purple-400" />
              <span className="text-gray-900 dark:text-white">Tägliche Statistiken</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
              <div className="text-center">
                <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">
                  {(100 - (kpis.violations / 24) * 100).toFixed(1)}%
                </div>
                <div className="text-xs lg:text-sm text-gray-500">Konformitätsrate</div>
              </div>
              <div className="text-center">
                <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">
                  {(kpis.max24h - kpis.min24h).toFixed(1)} dB
                </div>
                <div className="text-xs lg:text-sm text-gray-500">Tagesbereich</div>
              </div>
              <div className="text-center">
                <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">18:45</div>
                <div className="text-xs lg:text-sm text-gray-500">Spitzenzeit</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
