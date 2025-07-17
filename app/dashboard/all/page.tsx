"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Home, TrendingUp, Volume2, Clock, BarChart3, Download, Wind, AlertTriangle, Table as TableIcon, Activity, Droplets, Thermometer } from "lucide-react"
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart, LineChart, Legend } from "recharts"
import { useStationData, StationDataPoint } from "@/hooks/useStationData"
import { useState } from "react"
import Link from "next/link"
import { STATION_COLORS, CHART_COLORS } from "@/lib/colors"
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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

export default function AllLocationsPage() {
  // Chart-Intervall-Button-State
  const [chartInterval, setChartInterval] = useState<"24h" | "7d">("24h")
  const [granularity, setGranularity] = useState<"1h" | "10min" | "5min" | "1min">("10min")
  // Fetch live data für jede Station mit Intervall und Granularity
  const ortData = useStationData("ort", chartInterval, granularity)
  const heuballernData = useStationData("heuballern", chartInterval, granularity)
  const technoData = useStationData("techno", chartInterval, granularity)
  const bandData = useStationData("band", chartInterval, granularity)

  // Compose current levels for KPI cards (last value in each array)
  const currentLevels = {
    Ort: ortData.length > 0 ? ortData[ortData.length - 1].las : 0,
    Heuballern: heuballernData.length > 0 ? heuballernData[heuballernData.length - 1].las : 0,
    TechnoFloor: technoData.length > 0 ? technoData[technoData.length - 1].las : 0,
    Bandbuehne: bandData.length > 0 ? bandData[bandData.length - 1].las : 0,
  }

  // Aktuellste Wetterdaten (letzter Wert pro Station)
  const lastWeatherRaw = [ortData, heuballernData, technoData, bandData]
    .map(arr => arr.length > 0 ? arr[arr.length - 1] : null)
  const lastWeather = lastWeatherRaw.filter((d): d is StationDataPoint => d !== null)
  const avgWindSpeed = lastWeather.length > 0 ? (lastWeather.reduce((sum, d) => sum + (d.ws ?? 0), 0) / lastWeather.length).toFixed(1) : 'N/A'
  const avgWindDir = lastWeather.length > 0 ? lastWeather[0].wd ?? 'N/A' : 'N/A'
  const avgRelHumidity = lastWeather.length > 0 ? (lastWeather.reduce((sum, d) => sum + (d.rh ?? 0), 0) / lastWeather.length).toFixed(0) : 'N/A'
  const avgTemperature = lastWeather.length > 0 ? (lastWeather.reduce((sum, d) => sum + (d.temp ?? 0), 0) / lastWeather.length).toFixed(1) : 'N/A'

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

  // Chart-Daten für alle Standorte und Windgeschwindigkeit zusammenführen
  // Wir nehmen die Zeitpunkte von ortData als Basis
  const chartTimes = ortData.map(d => d.time)
  const chartData = chartTimes.map(time => {
    const ort = ortData.find(d => d.time === time)
    const heuballern = heuballernData.find(d => d.time === time)
    const techno = technoData.find(d => d.time === time)
    const band = bandData.find(d => d.time === time)
    // Windgeschwindigkeit: Mittelwert der vier Standorte, falls vorhanden
    const windVals = [ort, heuballern, techno, band].map(d => d?.ws).filter(v => typeof v === 'number')
    const windSpeed = windVals.length > 0 ? (windVals.reduce((a, b) => a + b, 0) / windVals.length) : undefined
    return {
      time,
      Ort: ort?.las ?? null,
      Heuballern: heuballern?.las ?? null,
      TechnoFloor: techno?.las ?? null,
      Bandbuehne: band?.las ?? null,
      windSpeed: windSpeed ?? null,
    }
  })

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
          {Object.entries(currentLevels).map(([location, level]) => (
            <UITooltip key={location}>
              <TooltipTrigger asChild>
                <motion.div
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
                          <Volume2 className="w-4 h-4" style={{ color: locationColors[location as keyof typeof locationColors] }} />
                          <span className={`text-xl lg:text-2xl font-bold ${getStatusColor(level)}`}>{level.toFixed(1)}</span>
                          <span className="text-xs lg:text-sm text-gray-500">dB</span>
                        </div>
                        {/* Klick-Hinweis */}
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Klicken für Details →</div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Klicken für detaillierte Ansicht von {location}</p>
                <p className="text-xs text-muted-foreground">Aktueller Pegel: {level.toFixed(1)} dB</p>
              </TooltipContent>
            </UITooltip>
          ))}
        </div>

        {/* Wetter-Übersicht Card */}
        <UITooltip>
          <TooltipTrigger asChild>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl cursor-help">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
                    <Wind className="w-4 lg:w-5 h-4 lg:h-5 text-blue-400" />
                    <span className="text-gray-900 dark:text-white">Wetter-Übersicht aller Standorte</span>
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
                        {avgWindSpeed}
                      </div>
                      <div className="text-xs lg:text-sm text-gray-500">km/h</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        <Activity className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Windrichtung</span>
                      </div>
                      <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">
                        {avgWindDir}
                      </div>
                      <div className="text-xs lg:text-sm text-gray-500">Durchschnitt</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        <Droplets className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Luftfeuchtigkeit</span>
                      </div>
                      <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">
                        {avgRelHumidity}%
                      </div>
                      <div className="text-xs lg:text-sm text-gray-500">Durchschnitt</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        <Thermometer className="w-4 h-4 text-orange-400" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Temperatur</span>
                      </div>
                      <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">
                        {avgTemperature}°C
                      </div>
                      <div className="text-xs lg:text-sm text-gray-500">Durchschnitt</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Aktuelle Wetterdaten von allen Standorten</p>
            <p className="text-xs text-muted-foreground">Durchschnittswerte für Wind, Luftfeuchtigkeit und Temperatur</p>
          </TooltipContent>
        </UITooltip>

        {/* Haupt-Diagramm */}
        <UITooltip>
          <TooltipTrigger asChild>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl cursor-help">
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold mr-2">Zeitraum:</span>
                      <UITooltip><TooltipTrigger asChild><Button variant={chartInterval === "24h" ? "default" : "outline"} size="sm" onClick={() => setChartInterval("24h")}>24</Button></TooltipTrigger><TooltipContent><p>Letzte 24 Stunden</p></TooltipContent></UITooltip>
                      <UITooltip><TooltipTrigger asChild><Button variant={chartInterval === "7d" ? "default" : "outline"} size="sm" onClick={() => setChartInterval("7d")}>7d</Button></TooltipTrigger><TooltipContent><p>Letzte 7 Tage</p></TooltipContent></UITooltip>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold mr-2">Granularität:</span>
                      <UITooltip><TooltipTrigger asChild><Button variant={granularity === "1h" ? "default" : "outline"} size="sm" onClick={() => setGranularity("1h")}>1h</Button></TooltipTrigger><TooltipContent><p>Stundenmittelwert</p></TooltipContent></UITooltip>
                      <UITooltip><TooltipTrigger asChild><Button variant={granularity === "10min" ? "default" : "outline"} size="sm" onClick={() => setGranularity("10min")}>10min</Button></TooltipTrigger><TooltipContent><p>10-Minuten-Mittelwert</p></TooltipContent></UITooltip>
                      <UITooltip><TooltipTrigger asChild><Button variant={granularity === "5min" ? "default" : "outline"} size="sm" onClick={() => setGranularity("5min")}>5min</Button></TooltipTrigger><TooltipContent><p>5-Minuten-Mittelwert</p></TooltipContent></UITooltip>
                      <UITooltip><TooltipTrigger asChild><Button variant={granularity === "1min" ? "default" : "outline"} size="sm" onClick={() => setGranularity("1min")}>1min</Button></TooltipTrigger><TooltipContent><p>1-Minuten-Wert</p></TooltipContent></UITooltip>
                    </div>
                  </div>
                  <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
                    <Activity className="w-4 lg:w-5 h-4 lg:h-5 text-blue-400" />
                    <span className="text-gray-900 dark:text-white">Vergleich aller Standorte</span>
                  </CardTitle>
                  <CardDescription className="text-xs lg:text-sm">
                    Lärmpegel-Vergleich mit Windgeschwindigkeits-Overlay
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 lg:h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
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
                          domain={[30, 85]}
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
                          formatter={(value: number, name: string): [string, string] => {
                            if (name === "windSpeed") return [`${value.toFixed(1)} km/h`, "Windgeschwindigkeit"]
                            return [`${value.toFixed(1)} dB`, name]
                          }}
                        />
                        {/* Legend */}
                        <Legend />
                        {/* Standort-Linien */}
                        <Line
                          type="monotone"
                          dataKey="Ort"
                          stroke={STATION_COLORS.ort.primary}
                          strokeWidth={2}
                          dot={false}
                          name="Ort"
                        />
                        <Line
                          type="monotone"
                          dataKey="Heuballern"
                          stroke={STATION_COLORS.heuballern.primary}
                          strokeWidth={2}
                          dot={false}
                          name="Heuballern"
                        />
                        <Line
                          type="monotone"
                          dataKey="TechnoFloor"
                          stroke={STATION_COLORS.techno.primary}
                          strokeWidth={2}
                          dot={false}
                          name="Techno Floor"
                        />
                        <Line
                          type="monotone"
                          dataKey="Bandbuehne"
                          stroke={STATION_COLORS.band.primary}
                          strokeWidth={2}
                          dot={false}
                          name="Band Bühne"
                        />
                        {/* Windgeschwindigkeit */}
                        <Line
                          yAxisId="wind"
                          type="monotone"
                          dataKey="windSpeed"
                          stroke={CHART_COLORS.warning}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          name="Wind (km/h)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Vergleich der Lärmpegel aller Standorte</p>
            <p className="text-xs text-muted-foreground">Gestrichelte Linie zeigt Windgeschwindigkeit</p>
          </TooltipContent>
        </UITooltip>

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
    </TooltipProvider>
  )
}
