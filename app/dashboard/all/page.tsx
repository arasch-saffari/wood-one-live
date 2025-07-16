"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wind, AlertTriangle, Volume2, Zap, Clock, Activity } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import Link from "next/link"

// Standort-spezifische Farben für konsistente Darstellung
const locationColors = {
  Ort: "#10b981", // emerald
  Heuballern: "#06b6d4", // cyan
  TechnoFloor: "#ec4899", // pink
  Bandbuehne: "#a855f7", // purple
}

// Standort-Routing Mapping
const locationRoutes = {
  Ort: "/dashboard/ort",
  Heuballern: "/dashboard/heuballern",
  TechnoFloor: "/dashboard/techno",
  Bandbuehne: "/dashboard/band",
}

// Mock-Daten Generator für realistische Lärmwerte
const generateMockData = () => {
  const locations = ["Ort", "Heuballern", "TechnoFloor", "Bandbuehne"]
  const now = new Date()
  const data = []

  // Generiere 48 Datenpunkte (12 Stunden in 15-Minuten Intervallen)
  for (let i = 0; i < 48; i++) {
    const timestamp = new Date(now.getTime() - (47 - i) * 15 * 60 * 1000)
    const entry: any = {
      time: timestamp.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      timestamp: timestamp.getTime(),
    }

    // Standort-spezifische Lärmwerte basierend auf Tageszeit
    locations.forEach((location) => {
      const baseLevel =
        location === "TechnoFloor" ? 65 : location === "Bandbuehne" ? 58 : location === "Heuballern" ? 38 : 45
      const variation = Math.random() * 15 - 7.5
      const timeOfDay = timestamp.getHours()
      const nightReduction = timeOfDay < 6 || timeOfDay > 22 ? -10 : 0
      const windSpeed = 8 + Math.random() * 12

      entry[location] = Math.max(30, baseLevel + variation + nightReduction)
      entry.windSpeed = windSpeed
    })

    data.push(entry)
  }

  return data
}

// Aktuelle Lärmwerte für KPI Cards
const getCurrentLevels = () => ({
  Ort: 42.3,
  Heuballern: 38.7,
  TechnoFloor: 67.2,
  Bandbuehne: 55.8,
})

// Aktuelle Winddaten
const getWindData = () => ({
  speed: 12.4,
  direction: "SW",
  gust: 18.7,
})

export default function AllLocationsPage() {
  // State Management für Live-Daten
  const [data, setData] = useState(generateMockData())
  const [currentLevels, setCurrentLevels] = useState(getCurrentLevels())
  const [windData, setWindData] = useState(getWindData())
  const [isLive, setIsLive] = useState(true)

  // Live-Daten Update Effekt
  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      setData(generateMockData())
      setCurrentLevels(getCurrentLevels())
      setWindData(getWindData())
    }, 5000) // Update alle 5 Sekunden

    return () => clearInterval(interval)
  }, [isLive])

  // Status-Farbe basierend auf Lärmwert bestimmen
  const getStatusColor = (level: number, isNight = false) => {
    const threshold = isNight ? 43 : 55
    const alarmThreshold = isNight ? 45 : 60

    if (level >= alarmThreshold) return "text-red-400"
    if (level >= threshold) return "text-yellow-400"
    return "text-emerald-400"
  }

  // Status-Badge basierend auf Lärmwert
  const getStatusBadge = (level: number, isNight = false) => {
    const threshold = isNight ? 43 : 55
    const alarmThreshold = isNight ? 45 : 60

    if (level >= alarmThreshold) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge>
    if (level >= threshold)
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge>
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Normal</Badge>
  }

  // Icon für Standort basierend auf Typ
  const getLocationIcon = (location: string) => {
    switch (location) {
      case "TechnoFloor":
        return <Volume2 className="w-4 h-4" style={{ color: locationColors.TechnoFloor }} />
      case "Bandbuehne":
        return <Volume2 className="w-4 h-4" style={{ color: locationColors.Bandbuehne }} />
      default:
        return (
          <Volume2 className="w-4 h-4" style={{ color: locationColors[location as keyof typeof locationColors] }} />
        )
    }
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Standort-Übersicht Cards - JETZT ANKLICKBAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {Object.entries(currentLevels).map(([location, level]) => (
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Link zu spezifischem Standort Dashboard */}
            <Link href={locationRoutes[location as keyof typeof locationRoutes]}>
              <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl transition-all duration-200 cursor-pointer hover:scale-105">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                      {location}
                    </CardTitle>
                    {getStatusBadge(level)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    {getLocationIcon(location)}
                    <span className={`text-xl lg:text-2xl font-bold ${getStatusColor(level)}`}>{level.toFixed(1)}</span>
                    <span className="text-xs lg:text-sm text-gray-500">dB</span>
                  </div>
                  {/* Klick-Hinweis */}
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Klicken für Details →</div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Wind-Daten Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="bg-gradient-to-r from-pink-500/5 to-purple-500/5 dark:from-pink-500/10 dark:to-purple-500/10 border-pink-500/20 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
              <Wind className="w-4 lg:w-5 h-4 lg:h-5 text-pink-400" />
              <span className="text-gray-900 dark:text-white">Windbedingungen</span>
              <Badge className="ml-auto bg-pink-500/20 text-pink-400 border-pink-500/30">
                <Clock className="w-3 h-3 mr-1" />
                Live
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Geschwindigkeit</p>
                <p className="text-lg lg:text-xl font-bold text-pink-400">{windData.speed} km/h</p>
              </div>
              <div>
                <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Richtung</p>
                <p className="text-lg lg:text-xl font-bold text-pink-400">{windData.direction}</p>
              </div>
              <div>
                <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Böen</p>
                <p className="text-lg lg:text-xl font-bold text-pink-400">{windData.gust} km/h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Haupt-Diagramm */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-2 lg:space-y-0">
              <div>
                <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
                  <Activity className="w-4 lg:w-5 h-4 lg:h-5 text-purple-400" />
                  <span className="text-gray-900 dark:text-white">Echtzeit Lärmwerte</span>
                </CardTitle>
                <CardDescription className="text-xs lg:text-sm">
                  Letzte 12 Stunden - 15-Minuten Intervalle
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                {/* Live/Pause Toggle */}
                <Button
                  variant={isLive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsLive(!isLive)}
                  className={cn(
                    "flex items-center space-x-1 text-xs lg:text-sm",
                    isLive
                      ? "bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800",
                  )}
                >
                  <Zap className="w-3 h-3" />
                  <span>{isLive ? "Live" : "Pausiert"}</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 lg:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  {/* Diagramm Gitter */}
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))" // Dynamische Farbe aus CSS-Variablen
                  />
                  {/* X-Achse (Zeit) */}
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} // Dynamische Farbe
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  {/* Y-Achse (Lärm) */}
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} // Dynamische Farbe
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  {/* Y-Achse (Wind) - rechts */}
                  <YAxis
                    yAxisId="wind"
                    orientation="right"
                    domain={[0, 25]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} // Dynamische Farbe
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  {/* Tooltip */}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))", // Dynamische Farbe
                      border: "1px solid hsl(var(--border))", // Dynamische Farbe
                      borderRadius: "12px",
                      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
                      color: "hsl(var(--card-foreground))", // Dynamische Farbe
                    }}
                  />
                  <Legend />
                  {/* Standort-spezifische Linien mit individuellen Farben */}
                  <Line
                    type="monotone"
                    dataKey="Ort"
                    stroke={locationColors.Ort}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4, fill: locationColors.Ort }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Heuballern"
                    stroke={locationColors.Heuballern}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4, fill: locationColors.Heuballern }}
                  />
                  <Line
                    type="monotone"
                    dataKey="TechnoFloor"
                    stroke={locationColors.TechnoFloor}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4, fill: locationColors.TechnoFloor }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Bandbuehne"
                    stroke={locationColors.Bandbuehne}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4, fill: locationColors.Bandbuehne }}
                  />
                  {/* Wind-Geschwindigkeit als gestrichelte Linie */}
                  <Line
                    type="monotone"
                    dataKey="windSpeed"
                    stroke="#6B7280"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    yAxisId="wind"
                    name="Windgeschwindigkeit"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              {/* Tagzeit Grenzwerte */}
              <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 text-sm lg:text-base">
                  Tagzeit (06:00 - 22:00)
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <span className="text-gray-600 dark:text-gray-400 text-xs lg:text-sm">Warnung: ≥ 55 dB</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <span className="text-gray-600 dark:text-gray-400 text-xs lg:text-sm">Alarm: ≥ 60 dB</span>
                  </div>
                </div>
              </div>
              {/* Nachtzeit Grenzwerte */}
              <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 text-sm lg:text-base">
                  Nachtzeit (22:00 - 06:00)
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <span className="text-gray-600 dark:text-gray-400 text-xs lg:text-sm">Warnung: ≥ 43 dB</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <span className="text-gray-600 dark:text-gray-400 text-xs lg:text-sm">Alarm: ≥ 45 dB</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
