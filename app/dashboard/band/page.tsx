"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Music, TrendingUp, Wind, Download, BarChart3, Clock } from "lucide-react"
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area } from "recharts"

// Generiert detaillierte Mock-Daten für den Standort "Band Bühne"
const generateBandData = () => {
  const now = new Date()
  const data = []

  for (let i = 0; i < 96; i++) {
    const timestamp = new Date(now.getTime() - (95 - i) * 15 * 60 * 1000)
    const hour = timestamp.getHours()

    // Band Bühne - Live-Musik-Auftritte
    let baseLevel = 42
    if (hour >= 19 && hour <= 23)
      baseLevel = 62 // Konzertzeit
    else if (hour >= 17 && hour < 19)
      baseLevel = 52 // Soundcheck
    else if (hour >= 14 && hour < 17)
      baseLevel = 48 // Aufbau
    else if (hour >= 0 && hour <= 6) baseLevel = 38 // Nachtruhe

    const windSpeed = 8 + Math.random() * 12
    const windDirection = Math.floor(Math.random() * 360)
    const variation = Math.random() * 8 - 4
    const windInfluence = windSpeed > 15 ? -0.8 : 0 // Wind trägt Schall weg

    const level = Math.max(35, baseLevel + variation + windInfluence)

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

// Generiert KPI-Werte für den Standort "Band Bühne"
const getKPIs = () => ({
  current: 57.3,
  avg24h: 48.6,
  max24h: 68.9,
  min24h: 36.2,
  violations: 8,
  trend: 1.8,
  currentWind: 11.2,
  windDirection: "W",
  nextShow: "20:30",
})

export default function BandPage() {
  const [data, setData] = useState(generateBandData())
  const [kpis, setKpis] = useState(getKPIs())

  // Aktualisiert Daten und KPIs in Intervallen
  useEffect(() => {
    const interval = setInterval(() => {
      setData(generateBandData())
      setKpis(getKPIs())
    }, 9000)

    return () => clearInterval(interval)
  }, [])

  // Bestimmt die Statusfarbe basierend auf dem Lärmpegel
  const getStatusColor = (level: number) => {
    if (level >= 60) return "text-red-400"
    if (level >= 55) return "text-yellow-400"
    return "text-purple-400"
  }

  // Bestimmt das Status-Badge basierend auf dem Lärmpegel
  const getStatusBadge = (level: number) => {
    if (level >= 60) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge>
    if (level >= 55) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge>
    return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Normal</Badge>
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
          <div className="w-8 lg:w-10 h-8 lg:h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Music className="w-4 lg:w-5 h-4 lg:h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-white dark:text-white text-gray-900">Band Bühne</h1>
            <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">
              Live-Musik-Bühne mit Auftrittsplan-Verfolgung
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(kpis.current)}
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

      {/* Auftrittsplan */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="bg-gradient-to-r from-purple-500/5 to-pink-500/5 dark:from-purple-500/20 dark:to-pink-500/20 border-purple-500/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Clock className="w-4 lg:w-5 h-4 lg:h-5 text-purple-400" />
                <div>
                  <p className="font-medium text-purple-300 text-sm lg:text-base">Nächster Auftritt</p>
                  <p className="text-xs lg:text-sm text-purple-400">
                    Geplant um {kpis.nextShow} - Windbedingungen günstig
                  </p>
                </div>
              </div>
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Bevorstehend</Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* KPI Karten */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                Aktueller Pegel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Music className="w-3 lg:w-4 h-3 lg:h-4 text-purple-400" />
                <span className={`text-lg lg:text-2xl font-bold ${getStatusColor(kpis.current)}`}>
                  {kpis.current.toFixed(1)}
                </span>
                <span className="text-xs lg:text-sm text-gray-500">dB</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                Spitze während Show
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-3 lg:w-4 h-3 lg:h-4 text-yellow-400" />
                <span className="text-lg lg:text-2xl font-bold text-yellow-400">{kpis.max24h.toFixed(1)}</span>
                <span className="text-xs lg:text-sm text-gray-500">dB</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Letzte Show: 21:45 Uhr</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                Wind-Effekt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Wind className="w-3 lg:w-4 h-3 lg:h-4 text-pink-400" />
                <span className="text-lg lg:text-2xl font-bold text-pink-400">{kpis.currentWind}</span>
                <span className="text-xs lg:text-sm text-gray-500">km/h</span>
              </div>
              <div className="text-xs text-emerald-400 mt-1">-0.8 dB Schalldispersion</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                Show-Verletzungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <span className="text-lg lg:text-2xl font-bold text-yellow-400">{kpis.violations}</span>
                <span className="text-xs lg:text-sm text-gray-500">heute</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Während der Auftritte</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Haupt-Diagramm */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
              <Music className="w-4 lg:w-5 h-4 lg:h-5 text-purple-400" />
              <span className="text-gray-900 dark:text-white">Band Bühne - Performance & Wetter-Einfluss</span>
            </CardTitle>
            <CardDescription className="text-xs lg:text-sm">
              Live-Musik-Überwachung mit Winddispersionsanalyse
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 lg:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <defs>
                    <linearGradient id="colorBand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
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
                    domain={[30, 75]}
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
                    stroke="#a855f7"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorBand)"
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
                  {/* Performance-Zeit-Indikatoren */}
                  <Line
                    yAxisId="noise"
                    type="monotone"
                    dataKey={() => 55}
                    stroke="#facc15"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    name="Warnung"
                  />
                  <Line
                    yAxisId="noise"
                    type="monotone"
                    dataKey={() => 60}
                    stroke="#f87171"
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

      {/* Performance-Analyse */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
              <BarChart3 className="w-4 lg:w-5 h-4 lg:h-5 text-purple-400" />
              <span className="text-gray-900 dark:text-white">Performance-Einfluss-Analyse</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
              <div className="text-center">
                <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">19:00-23:00</div>
                <div className="text-xs lg:text-sm text-gray-500">Spitzen-Performance-Stunden</div>
              </div>
              <div className="text-center">
                <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">-0.8 dB</div>
                <div className="text-xs lg:text-sm text-gray-500">Winddispersions-Effekt</div>
              </div>
              <div className="text-center">
                <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">92%</div>
                <div className="text-xs lg:text-sm text-gray-500">Konformität während Shows</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
