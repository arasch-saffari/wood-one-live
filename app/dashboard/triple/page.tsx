"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Music, Volume2, BarChart3, TrendingUp, AlertTriangle } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useStationData } from '@/hooks/useStationData'

// Generiert Mock-Daten für die Dreifachansicht
const generateTripleData = () => {
  const now = new Date()
  const data = []

  for (let i = 0; i < 48; i++) {
    const timestamp = new Date(now.getTime() - (47 - i) * 15 * 60 * 1000)
    const hour = timestamp.getHours()

    // Unterschiedliche Muster für jeden Standort
    const ortBase = hour >= 22 || hour <= 6 ? 35 : 45
    const technoBase = hour >= 20 && hour <= 2 ? 70 : 50
    const bandBase = hour >= 19 && hour <= 23 ? 60 : 40

    data.push({
      time: timestamp.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      timestamp: timestamp.getTime(),
      Ort: Math.max(30, ortBase + Math.random() * 10 - 5),
      TechnoFloor: Math.max(35, technoBase + Math.random() * 15 - 7.5),
      Bandbuehne: Math.max(30, bandBase + Math.random() * 12 - 6),
    })
  }

  return data
}

// Generiert aktuelle Statistiken für die Dreifachansicht
const getCurrentStats = () => ({
  Ort: { level: 42.3, status: "normal", trend: 1.2 },
  TechnoFloor: { level: 67.2, status: "alarm", trend: -2.1 },
  Bandbuehne: { level: 55.8, status: "warning", trend: 0.8 },
})

// Hilfsfunktionen für Status und Trend aus echten Daten
function getStatus(level: number): 'alarm' | 'warning' | 'normal' {
  if (level >= 60) return 'alarm'
  if (level >= 55) return 'warning'
  return 'normal'
}
function getTrend(data: { las: number }[]): number {
  if (data.length < 2) return 0
  const last = data[data.length - 1]?.las ?? 0
  const prev = data[data.length - 2]?.las ?? 0
  if (prev === 0) return 0
  return ((last - prev) / prev) * 100
}

export default function TriplePage() {
  // Echte Messdaten für die drei Standorte laden
  const ortData = useStationData('ort', '24h', '15min')
  const technoData = useStationData('techno', '24h', '15min')
  const bandData = useStationData('band', '24h', '15min')

  // Gemeinsame Zeitachsenpunkte bestimmen (datetime)
  const allDatetimes = Array.from(new Set([
    ...ortData.map(d => d.datetime),
    ...technoData.map(d => d.datetime),
    ...bandData.map(d => d.datetime),
  ].filter(Boolean) as string[])).sort()

  // Chartdaten zusammenbauen: für jeden Zeitpunkt die Werte der drei Standorte
  const chartData = allDatetimes.map(datetime => {
    const ort = ortData.find(d => d.datetime === datetime)
    const techno = technoData.find(d => d.datetime === datetime)
    const band = bandData.find(d => d.datetime === datetime)
    return {
      datetime,
      time: datetime ? new Date(datetime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }) : '',
      Ort: ort?.las ?? null,
      TechnoFloor: techno?.las ?? null,
      Bandbuehne: band?.las ?? null,
    }
  })

  // Bestimmt das Status-Badge basierend auf dem Status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "alarm":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge>
      case "warning":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge>
      default:
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Normal</Badge>
    }
  }

  // Bestimmt die Statusfarbe basierend auf dem Status
  const getStatusColor = (status: string) => {
    switch (status) {
      case "alarm":
        return "text-red-400"
      case "warning":
        return "text-yellow-400"
      default:
        return "text-emerald-400"
    }
  }

  const locations = [
    {
      key: "Ort",
      name: "Ort",
      icon: MapPin,
      color: "from-emerald-500 to-emerald-600",
      chartColor: "#10b981",
    },
    {
      key: "TechnoFloor",
      name: "Techno Floor",
      icon: Volume2,
      color: "from-pink-500 to-pink-600",
      chartColor: "#ec4899",
    },
    {
      key: "Bandbuehne",
      name: "Bandbühne",
      icon: Music,
      color: "from-purple-500 to-purple-600",
      chartColor: "#a855f7",
    },
  ]

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header Bereich */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between space-y-3 lg:space-y-0"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 lg:w-10 h-8 lg:h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-4 lg:w-5 h-4 lg:h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Dreifachansicht</h1>
            <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">
              Ort, Techno Floor & Bandbühne Vergleich
            </p>
          </div>
        </div>
      </motion.div>

      {/* Standortkarten */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
        {locations.map((location, index) => {
          const series =
            location.key === 'Ort' ? ortData :
            location.key === 'TechnoFloor' ? technoData :
            bandData
          const last = series[series.length - 1]?.las ?? 0
          const trend = getTrend(series)
          const status = getStatus(last)
          return (
            <motion.div
              key={location.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-6 lg:w-8 h-6 lg:h-8 bg-gradient-to-br ${location.color} rounded-lg flex items-center justify-center`}
                      >
                        <location.icon className="w-3 lg:w-4 h-3 lg:h-4 text-white" />
                      </div>
                      <CardTitle className="text-sm lg:text-lg text-gray-900 dark:text-white">{location.name}</CardTitle>
                    </div>
                    {getStatusBadge(status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <span className={`text-2xl lg:text-3xl font-bold ${getStatusColor(status)}`}>{last.toFixed(1)}</span>
                      <span className="text-xs lg:text-sm text-gray-500">dB</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <TrendingUp className={`w-3 h-3 ${trend > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
                      <span className={`text-xs ${trend > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{trend > 0 ? '+' : ''}{trend.toFixed(1)}% vs vor 1 Block</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Vergleichsdiagramm */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
              <BarChart3 className="w-4 lg:w-5 h-4 lg:h-5 text-purple-400" />
              <span className="text-gray-900 dark:text-white">Vergleichende Analyse</span>
            </CardTitle>
            <CardDescription className="text-xs lg:text-sm">
              Echtzeit-Vergleich der Lärmpegel an drei Schlüsselstandorten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 lg:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="datetime"
                    tickFormatter={dt => new Date(dt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis
                    domain={[30, 80]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <Tooltip
                    labelFormatter={dt => new Date(dt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                  <Legend />
                  {locations.map((location) => (
                    <Line
                      key={location.key}
                      type="monotone"
                      dataKey={location.key}
                      stroke={location.chartColor}
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, fill: location.chartColor }}
                      connectNulls
                    />
                  ))}
                  {/* Grenzwertlinien */}
                  <Line
                    type="monotone"
                    dataKey={() => 55}
                    stroke="#facc15"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Tag Warnung"
                  />
                  <Line
                    type="monotone"
                    dataKey={() => 60}
                    stroke="#f87171"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Tag Alarm"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Analyse-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="bg-gradient-to-br from-red-500/5 to-pink-500/5 dark:from-red-500/20 dark:to-pink-500/20 border-red-500/30 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
                <AlertTriangle className="w-4 lg:w-5 h-4 lg:h-5 text-red-400" />
                <span className="text-gray-900 dark:text-white">Aktuelle Alarme</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-xs lg:text-sm font-medium text-red-300">Techno Floor</span>
                  </div>
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                    <span className="text-xs lg:text-sm font-medium text-yellow-300">Bandbühne</span>
                  </div>
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card className="bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 dark:from-emerald-500/20 dark:to-cyan-500/20 border-emerald-500/30 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
                <BarChart3 className="w-4 lg:w-5 h-4 lg:h-5 text-emerald-400" />
                <span className="text-gray-900 dark:text-white">Performance-Zusammenfassung</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Konformitätsrate</span>
                  <span className="font-semibold text-emerald-400">87.5%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Spitzenstandort</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-300">Techno Floor</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Ruhigster Standort</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-300">Ort</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
