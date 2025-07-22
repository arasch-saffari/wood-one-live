"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, Wind, AlertTriangle, Table as TableIcon, Activity, Droplets, Thermometer } from "lucide-react"
import { useStationData } from "@/hooks/useStationData"
import { useEffect, useState } from "react"
import Link from "next/link"
import { STATION_META } from "@/lib/stationMeta"
import {
  TooltipProvider,
  Tooltip as UITooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { useWeatherData } from "@/hooks/useWeatherData"
import { useConfig } from "@/hooks/useConfig"
import { cn } from '@/lib/utils'
import { ChartPlayground } from '@/components/ChartPlayground'
import { useHealth } from "@/hooks/useHealth"

export default function AllLocationsPage() {
  const { config } = useConfig();
  const [maxPoints, setMaxPoints] = useState<number>(0)
  const ortData = useStationData("ort").data ?? []
  const heuballernData = useStationData("heuballern").data ?? []
  const technoData = useStationData("techno").data ?? []
  const bandData = useStationData("band").data ?? []
  const { weather: latestWeather } = useWeatherData("global", "now")
  const { health } = useHealth();

  if (!config) return <div className="flex items-center justify-center min-h-[300px] text-gray-400 text-sm">Lade Konfiguration ...</div>;

  // Chart-Daten für alle Standorte zusammenführen
  const chartTimes = Array.from(new Set([
    ...ortData.map(d => d.time),
    ...bandData.map(d => d.time),
    ...technoData.map(d => d.time),
    ...heuballernData.map(d => d.time),
  ])).sort();
  const chartData = chartTimes.map(time => {
    const ort = ortData.find((d: { time: string }) => d.time === time)
    const techno = technoData.find((d: { time: string }) => d.time === time)
    const band = bandData.find((d: { time: string }) => d.time === time)
    const heuballern = heuballernData.find((d: { time: string }) => d.time === time)
    return {
      time,
      ort: ort?.maxSPLAFast ?? null,
      techno: techno?.maxSPLAFast ?? null,
      band: band?.maxSPLAFast ?? null,
      heuballern: heuballern?.maxSPLAFast ?? null,
    }
  })

  const currentLevels = {
    ort: ortData.length > 0 ? ortData[ortData.length - 1].maxSPLAFast : 0,
    techno: technoData.length > 0 ? technoData[technoData.length - 1].maxSPLAFast : 0,
    band: bandData.length > 0 ? bandData[bandData.length - 1].maxSPLAFast : 0,
    heuballern: heuballernData.length > 0 ? heuballernData[heuballernData.length - 1].maxSPLAFast : 0,
  }

  const filteredChartData = maxPoints > 0 && chartData.length > maxPoints ? chartData.slice(-maxPoints) : chartData

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
          {Object.entries(currentLevels).map(([location, level]) => {
            const meta = STATION_META[location as keyof typeof STATION_META]
            return (
              <motion.div key={location}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Link href={`/dashboard/${location}`}>
                  <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl transition-all duration-200 cursor-pointer hover:scale-105">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
                          {meta.name}
                        </CardTitle>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <div>{level >= 60 ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge> : level >= 55 ? <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge> : <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Normal</Badge>}</div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Status: {level.toFixed(1)} dB</p>
                            <p className="text-xs text-muted-foreground">Klicken für Details</p>
                          </TooltipContent>
                        </UITooltip>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <meta.icon className={`w-4 h-4 text-${meta.kpiColor}`} />
                        <span className={`text-xl lg:text-2xl font-bold text-emerald-400`}>{level.toFixed(1)}</span>
                        <span className="text-xs lg:text-sm text-gray-500">dB</span>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Klicken für Details →</div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )})}
        </div>

        {/* Wetter-Übersicht Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
                <Wind className="w-4 lg:w-5 h-4 lg:h-5 text-blue-400" />
                <span className="text-gray-900 dark:text-white">Wetter – aktuellster Wert</span>
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
                    {latestWeather?.windSpeed !== undefined ? latestWeather.windSpeed.toFixed(1) : '–'}
                  </div>
                  <div className="text-xs lg:text-sm text-gray-500">km/h</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Windrichtung</span>
                  </div>
                  <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">
                    {latestWeather?.windDir ?? '–'}
                  </div>
                  <div className="text-xs lg:text-sm text-gray-500">aktuell</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Droplets className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Luftfeuchtigkeit</span>
                  </div>
                  <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">
                    {latestWeather?.relHumidity !== undefined ? latestWeather.relHumidity.toFixed(0) : '–'}%
                  </div>
                  <div className="text-xs lg:text-sm text-gray-500">aktuell</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Thermometer className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Temperatur</span>
                  </div>
                  <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-300">
                    {typeof latestWeather?.temperature === 'number' ? Math.round(latestWeather.temperature) : '–'}°C
                  </div>
                  <div className="text-xs lg:text-sm text-gray-500">aktuell</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Chart für alle Standorte */}
        <ChartPlayground
          data={ortData}
          title="Alle Standorte"
          icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
          maxPoints={maxPoints}
          onMaxPointsChange={setMaxPoints}
        />
      </div>
    </TooltipProvider>
  )
}
