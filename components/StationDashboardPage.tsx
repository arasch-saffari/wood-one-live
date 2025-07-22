"use client";
import { useStationData } from "@/hooks/useStationData"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { MapPin, Music, Volume2 } from "lucide-react"
import { STATION_COLORS } from "@/lib/colors"
import { StationHeader } from "@/components/StationHeader"
import { StationKPIs } from "@/components/StationKPIs"
import { StationAlert } from "@/components/StationAlert"
import { StationTableLink } from "@/components/StationTableLink"
import { ChartPlayground } from "@/components/ChartPlayground"
import { useConfig } from "@/hooks/useConfig"

const STATION_META = {
  ort: {
    name: "Ort",
    color: "emerald",
    icon: <MapPin className="w-4 lg:w-5 h-4 lg:h-5 text-white" />,
    gradient: "from-emerald-500 to-emerald-600",
    kpiColor: "emerald-400",
    chartColor: STATION_COLORS.ort,
  },
  band: {
    name: "Band Bühne",
    color: "purple",
    icon: <Music className="w-4 lg:w-5 h-4 lg:h-5 text-white" />,
    gradient: "from-purple-500 to-purple-600",
    kpiColor: "purple-400",
    chartColor: STATION_COLORS.band,
  },
  techno: {
    name: "Techno Floor",
    color: "pink",
    icon: <Volume2 className="w-4 lg:w-5 h-4 lg:h-5 text-white" />,
    gradient: "from-pink-500 to-pink-600",
    kpiColor: "pink-400",
    chartColor: STATION_COLORS.techno,
  },
  heuballern: {
    name: "Heuballern",
    color: "cyan",
    icon: <MapPin className="w-4 lg:w-5 h-4 lg:h-5 text-white" />,
    gradient: "from-cyan-500 to-cyan-600",
    kpiColor: "cyan-400",
    chartColor: STATION_COLORS.heuballern,
  },
} as const

type StationKey = keyof typeof STATION_META

interface StationDashboardPageProps {
  station: StationKey;
}

export function StationDashboardPage({ station }: StationDashboardPageProps) {
  const meta = STATION_META[station]
  const { data: chartData } = useStationData(station)
  const { config: globalConfig } = useConfig();
  if (!globalConfig) return <div className="flex items-center justify-center min-h-[300px] text-gray-400 text-sm">Lade Konfiguration ...</div>;

  // KPIs
  const current = chartData.length > 0 ? chartData[chartData.length - 1].maxSPLAFast : 0
  const avg24h = chartData.length > 0 ? (chartData.reduce((a, b) => a + b.maxSPLAFast, 0) / chartData.length).toFixed(1) : 0
  const max24h = chartData.length > 0 ? Math.max(...chartData.map(d => d.maxSPLAFast)) : 0
  const trend = chartData.length > 1 ? ((chartData[chartData.length - 1].maxSPLAFast - chartData[chartData.length - 2].maxSPLAFast) / chartData[chartData.length - 2].maxSPLAFast * 100).toFixed(1) : 0

  const thresholds = { warning: 55, alarm: 60 }
  let alertStatus: 'normal' | 'warn' | 'alarm' = 'normal'
  if (current >= thresholds.alarm) alertStatus = 'alarm'
  else if (current >= thresholds.warning) alertStatus = 'warn'
  const alertConfig = {
    normal: {
      bg: `from-${meta.color}-500/10 to-${meta.color}-600/10 border-${meta.color}-500/20`,
      icon: meta.icon,
      title: 'Lärmpegels im Normalbereich',
      text: `Aktueller Pegel: ${current.toFixed(1)} dB. Keine Grenzwertüberschreitung.`,
      textColor: `text-${meta.kpiColor}`,
    },
    warn: {
      bg: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
      icon: meta.icon,
      title: 'Warnung: Lärmpegels erhöht',
      text: `Pegel liegt im Warnbereich (${current.toFixed(1)} dB).`,
      textColor: 'text-yellow-400',
    },
    alarm: {
      bg: 'from-red-500/20 to-red-600/20 border-red-500/30',
      icon: meta.icon,
      title: 'Alarm: Hoher Lärmpegels',
      text: `Pegel überschreitet Alarmgrenzwert (${current.toFixed(1)} dB).`,
      textColor: 'text-red-400',
    },
  }[alertStatus]
  const getStatusBadge = (level: number) => {
    if (level >= thresholds.alarm) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge>
    if (level >= thresholds.warning) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge>
    return <Badge className={`bg-${meta.color}-500/20 text-${meta.kpiColor} border-${meta.color}-500/30`}>Normal</Badge>
  }
  return (
    <div className="space-y-4 lg:space-y-6">
      <StationHeader
        icon={meta.icon}
        name={meta.name}
        color={meta.color}
        gradient={meta.gradient}
        statusBadge={getStatusBadge(current)}
        subtitle={`${meta.name} mit Wetter-Einfluss-Analyse`}
      />
      <StationAlert
        bg={alertConfig.bg}
        icon={alertConfig.icon}
        title={alertConfig.title}
        text={alertConfig.text}
        textColor={alertConfig.textColor}
      />
      <StationKPIs
        current={current}
        avg24h={avg24h}
        max24h={max24h}
        trend={trend}
        currentWind={''}
        windDirection={''}
        kpiColor={meta.kpiColor}
      />
      <StationTableLink station={station} />
      <ChartPlayground
        data={chartData}
        title={meta.name}
        icon={meta.icon}
      />
    </div>
  )
} 