"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Activity, Calendar, Download, Filter } from "lucide-react"

// Generiert Mock-Daten für die Heatmap basierend auf dem Standort
const generateHeatmapData = (location: string) => {
  interface HeatmapDataPoint {
    hour: number
    quarter: number
    level: number
    time: string
  }
  const data: HeatmapDataPoint[] = []
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const quarters = Array.from({ length: 4 }, (_, i) => i * 15)

  hours.forEach((hour) => {
    quarters.forEach((quarter) => {
      let baseLevel = 40

      // Unterschiedliche Muster basierend auf dem Standort
      if (location === "TechnoFloor") {
        baseLevel = hour >= 20 || hour <= 2 ? 70 : 45
      } else if (location === "Bandbuehne") {
        baseLevel = hour >= 19 && hour <= 23 ? 60 : 40
      } else {
        baseLevel = hour >= 6 && hour <= 22 ? 45 : 35
      }

      const variation = Math.random() * 15 - 7.5
      const level = Math.max(30, Math.min(80, baseLevel + variation))

      data.push({
        hour,
        quarter,
        level,
        time: `${hour.toString().padStart(2, "0")}:${quarter.toString().padStart(2, "0")}`,
      })
    })
  })

  return data
}

// Bestimmt die Intensitätsfarbe basierend auf dem Lärmpegel
const getIntensityColor = (level: number) => {
  if (level < 40) return "bg-green-200 dark:bg-green-800"
  if (level < 45) return "bg-green-300 dark:bg-green-700"
  if (level < 50) return "bg-yellow-200 dark:bg-yellow-800"
  if (level < 55) return "bg-yellow-400 dark:bg-yellow-600"
  if (level < 60) return "bg-orange-400 dark:bg-orange-600"
  if (level < 65) return "bg-red-400 dark:bg-red-600"
  return "bg-red-600 dark:bg-red-500"
}

export default function HeatmapPage() {
  const [selectedLocation, setSelectedLocation] = useState("Ort")
  const [selectedDate, setSelectedDate] = useState("today")
  const [heatmapData, setHeatmapData] = useState(generateHeatmapData("Ort"))

  // Aktualisiert die Heatmap-Daten, wenn der Standort wechselt
  useEffect(() => {
    setHeatmapData(generateHeatmapData(selectedLocation))
  }, [selectedLocation])

  const locations = ["Ort", "Heuballern", "TechnoFloor", "Bandbuehne"]
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const quarters = [0, 15, 30, 45]

  return (
    <div className="space-y-6">
      {/* Header Bereich */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Lärm-Heatmap</h1>
            <p className="text-slate-600 dark:text-slate-400">24-Stunden Lärmmuster-Visualisierung</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* Standortauswahl */}
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700">
              <SelectValue placeholder="Standort wählen" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700">
              {locations.map((location) => (
                <SelectItem key={location} value={location}>
                  {location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 bg-transparent"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </motion.div>

      {/* Filter & Optionen */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-indigo-600" />
                <span className="text-gray-900 dark:text-white">Filter & Optionen</span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                {/* Datumsauswahl */}
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger className="w-32 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Datum wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700">
                    <SelectItem value="today">Heute</SelectItem>
                    <SelectItem value="yesterday">Gestern</SelectItem>
                    <SelectItem value="week">Diese Woche</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Heatmap Darstellung */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-purple-600" />
              <span className="text-gray-900 dark:text-white">24-Stunden Lärmmuster - {selectedLocation}</span>
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Jede Zelle repräsentiert ein 15-Minuten-Intervall. Dunklere Farben zeigen höhere Lärmpegel an.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Zeit-Labels (Stunden) */}
              <div className="flex">
                <div className="w-12"></div>
                <div className="flex-1 grid grid-cols-24 gap-1">
                  {hours.map((hour) => (
                    <div key={hour} className="text-xs text-center text-slate-500 dark:text-slate-400">
                      {hour.toString().padStart(2, "0")}
                    </div>
                  ))}
                </div>
              </div>

              {/* Heatmap Gitter */}
              {quarters.map((quarter) => (
                <div key={quarter} className="flex items-center">
                  <div className="w-12 text-xs text-slate-500 dark:text-slate-400">
                    :{quarter.toString().padStart(2, "0")}
                  </div>
                  <div className="flex-1 grid grid-cols-24 gap-1">
                    {hours.map((hour) => {
                      const dataPoint = heatmapData.find((d) => d.hour === hour && d.quarter === quarter)
                      const level = dataPoint?.level || 0
                      return (
                        <motion.div
                          key={`${hour}-${quarter}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (hour * 4 + quarter / 15) * 0.01 }}
                          className={`h-8 rounded ${getIntensityColor(level)} cursor-pointer transition-all hover:scale-110 hover:shadow-lg`}
                          title={`${hour.toString().padStart(2, "0")}:${quarter.toString().padStart(2, "0")} - ${level.toFixed(1)} dB`}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Legende */}
              <div className="flex items-center justify-center space-x-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Niedrig</span>
                  <div className="flex space-x-1">
                    <div className="w-4 h-4 bg-green-200 dark:bg-green-800 rounded"></div>
                    <div className="w-4 h-4 bg-green-300 dark:bg-green-700 rounded"></div>
                    <div className="w-4 h-4 bg-yellow-200 dark:bg-yellow-800 rounded"></div>
                    <div className="w-4 h-4 bg-yellow-400 dark:bg-yellow-600 rounded"></div>
                    <div className="w-4 h-4 bg-orange-400 dark:bg-orange-600 rounded"></div>
                    <div className="w-4 h-4 bg-red-400 dark:bg-red-600 rounded"></div>
                    <div className="w-4 h-4 bg-red-600 dark:bg-red-500 rounded"></div>
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">Hoch</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">30-40 dB</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">•</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">40-50 dB</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">•</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">50-60 dB</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">•</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">60+ dB</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Statistiken */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-0 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Spitzenstunden</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {selectedLocation === "TechnoFloor"
                  ? "20:00-02:00"
                  : selectedLocation === "Bandbuehne"
                    ? "19:00-23:00"
                    : "07:00-09:00"}
              </div>
              <div className="text-xs text-slate-500 mt-1">Periode höchster Aktivität</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-0 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Ruhige Stunden</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {selectedLocation === "TechnoFloor" ? "06:00-18:00" : "02:00-06:00"}
              </div>
              <div className="text-xs text-slate-500 mt-1">Periode niedrigster Aktivität</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-0 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Verletzungen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {selectedLocation === "TechnoFloor" ? "12" : selectedLocation === "Bandbuehne" ? "5" : "2"}
              </div>
              <div className="text-xs text-slate-500 mt-1">Grenzwert heute überschritten</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
