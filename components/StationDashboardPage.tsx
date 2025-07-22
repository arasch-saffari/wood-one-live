"use client";
import { useStationData, StationDataPoint } from "@/hooks/useStationData"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { MapPin, Music, Volume2 } from "lucide-react"
import { STATION_COLORS, CHART_COLORS, getStationColor } from "@/lib/colors"
import { toast } from "@/components/ui/use-toast"
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

// Typen für Props und Daten
interface StationDashboardPageProps {
  station: StationKey;
}
interface Thresholds {
  warning: number;
  alarm: number;
}

interface ThresholdBlock {
  from: string;
  to: string;
  warning: number;
  alarm: number;
  las: number;
  laf: number;
}

// Hilfsfunktion: Windrichtung (Grad oder Abkürzung) in ausgeschriebenen Text umwandeln
function windDirectionText(dir: number | string | null | undefined): string {
  if (dir === null || dir === undefined) return '–';
  const deg = typeof dir === 'string' ? parseFloat(dir) : dir;
  if (isNaN(deg)) {
    // Falls es eine Abkürzung ist
    const map: Record<string, string> = {
      n: 'Norden', nne: 'Nordnordost', ne: 'Nordost', ene: 'Ostnordost',
      e: 'Osten', ese: 'Ostsüdost', se: 'Südost', sse: 'Südsüdost',
      s: 'Süden', ssw: 'Südsüdwest', sw: 'Südwest', wsw: 'Westsüdwest',
      w: 'Westen', wnw: 'Westnordwest', nw: 'Nordwest', nnw: 'Nordnordwest'
    };
    const key = typeof dir === 'string' ? dir.toLowerCase() : '';
    return map[key] || dir.toString();
  }
  // Gradzahl in Richtungstext
  const directions = [
    'Norden', 'Nordnordost', 'Nordost', 'Ostnordost',
    'Osten', 'Ostsüdost', 'Südost', 'Südsüdost',
    'Süden', 'Südsüdwest', 'Südwest', 'Westsüdwest',
    'Westen', 'Westnordwest', 'Nordwest', 'Nordnordwest', 'Norden'
  ];
  const idx = Math.round(((deg % 360) / 22.5));
  return directions[idx];
}

export function StationDashboardPage({ station }: StationDashboardPageProps) {
  const meta = STATION_META[station]
  const [chartInterval, setChartInterval] = useState<"24h" | "7d">("24h")
  const [granularity, setGranularity] = useState<"15min" | "10min" | "5min" | "1min" | "1h">("15min")
  const { data: chartData } = useStationData(station, chartInterval, granularity)
  const [config, setConfig] = useState<any>(null)
  const { config: globalConfig } = useConfig();
  const visibleLines = globalConfig?.chartVisibleLines?.[station] || ["las"];
  useEffect(() => {
    fetch('/api/admin/config')
      .then(res => {
        if (!res.ok) throw new Error('Fehler beim Laden der Konfiguration')
        return res.json()
      })
      .then(setConfig)
      .catch(() => {
        toast({
          title: 'Fehler',
          description: 'Konfiguration konnte nicht geladen werden.',
          variant: 'destructive',
        })
      })
  }, [])
  useEffect(() => {
  }, [chartData])
  if (!globalConfig) return <div className="flex items-center justify-center min-h-[300px] text-gray-400 text-sm">Lade Konfiguration ...</div>;
  console.log("ConfigContext in StationDashboardPage:", globalConfig);
  // KPIs
  const current = chartData.length > 0 ? chartData[chartData.length - 1].las : 0
  const avg24h = chartData.length > 0 ? (chartData.reduce((a, b) => a + b.las, 0) / chartData.length).toFixed(1) : 0
  const max24h = chartData.length > 0 ? Math.max(...chartData.map(d => d.las)) : 0
  const trend = chartData.length > 1 ? ((chartData[chartData.length - 1].las - chartData[chartData.length - 2].las) / chartData[chartData.length - 2].las * 100).toFixed(1) : 0
  const currentWind = chartData.length > 0 ? chartData[chartData.length - 1].ws : 0
  const windDirection = chartData.length > 0 ? chartData[chartData.length - 1].wd : "N/A"
  // Dynamische Schwellenwerte aus config bestimmen
  function getDynamicThresholds(
    config: any,
    station: string,
    chartData: any[]
  ): ThresholdBlock {
    if (!config || !config.thresholdsByStationAndTime || !chartData.length) return { warning: 55, alarm: 60, las: 50, laf: 52, from: "00:00", to: "23:59" }
    const now = chartData[chartData.length - 1]?.datetime?.slice(11, 16)
    const blocks: ThresholdBlock[] = config.thresholdsByStationAndTime[station]
    if (!blocks) return { warning: 55, alarm: 60, las: 50, laf: 52, from: "00:00", to: "23:59" }
    // Finde das Zeitfenster, das jetzt passt
    const currentBlock = blocks.find((b: ThresholdBlock) => {
      if (!b.from || !b.to || !now) return false
      if (b.from < b.to) {
        // Tagzeit (z.B. 06:00-22:00)
        return now >= b.from && now < b.to
      } else {
        // Nachtzeit (z.B. 22:00-06:00, über Mitternacht)
        return now >= b.from || now < b.to
      }
    })
    return currentBlock || { warning: 55, alarm: 60, las: 50, laf: 52, from: "00:00", to: "23:59" }
  }
  const thresholds = getDynamicThresholds(config, station, chartData)
  let alertStatus: 'normal' | 'warn' | 'alarm' = 'normal'
  if (current >= thresholds.alarm) alertStatus = 'alarm'
  else if (current >= thresholds.warning) alertStatus = 'warn'
  const alertConfig = {
    normal: {
      bg: `from-${meta.color}-500/10 to-${meta.color}-600/10 border-${meta.color}-500/20`,
      icon: meta.icon,
      title: 'Lärmpegel im Normalbereich',
      text: `Aktueller Pegel: ${current.toFixed(1)} dB. Keine Grenzwertüberschreitung.`,
      textColor: `text-${meta.kpiColor}`,
    },
    warn: {
      bg: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
      icon: meta.icon,
      title: 'Warnung: Lärmpegel erhöht',
      text: `Pegel liegt im Warnbereich (${current.toFixed(1)} dB). Windrichtung: ${windDirectionText(windDirection)} bei ${currentWind ? currentWind : "N/A"} km/h`,
      textColor: 'text-yellow-400',
    },
    alarm: {
      bg: 'from-red-500/20 to-red-600/20 border-red-500/30',
      icon: meta.icon,
      title: 'Alarm: Hoher Lärmpegel',
      text: `Pegel überschreitet Alarmgrenzwert (${current.toFixed(1)} dB). Windrichtung: ${windDirectionText(windDirection)} bei ${currentWind ? currentWind : "N/A"} km/h`,
      textColor: 'text-red-400',
    },
  }[alertStatus]
  const getStatusBadge = (level: number) => {
    if (level >= thresholds.alarm) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge>
    if (level >= thresholds.warning) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge>
    return <Badge className={`bg-${meta.color}-500/20 text-${meta.kpiColor} border-${meta.color}-500/30`}>Normal</Badge>
  }
  // Mappe las: immer laf bevorzugen, sonst las
  // Typ-Erweiterung für Mapping
  type StationDataPointWithLaf = StationDataPoint & { laf?: number };
  const chartDataMapped = Array.isArray(chartData)
    ? (chartData as StationDataPointWithLaf[]).map(d => ({ ...d, las: d.laf ?? d.las }))
    : chartData;
  if (Array.isArray(chartDataMapped)) {
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
        currentWind={currentWind ?? 0}
        windDirection={windDirectionText(windDirection)}
        kpiColor={meta.kpiColor}
      />
      <StationTableLink station={station} />
      <ChartPlayground
        data={chartDataMapped}
        lines={[
          { key: 'las', label: 'Lärmpegel', color: getStationColor(station, 'primary'), yAxisId: 'left', visible: visibleLines.includes('las') },
          { key: 'ws', label: 'Wind', color: CHART_COLORS.wind, yAxisId: 'wind', strokeDasharray: '5 5', visible: visibleLines.includes('ws') },
          { key: 'rh', label: 'Luftfeuchte', color: CHART_COLORS.humidity, yAxisId: 'left', strokeDasharray: '2 2', visible: visibleLines.includes('rh') },
          { key: 'temp', label: 'Temperatur', color: CHART_COLORS.temperature, yAxisId: 'left', strokeDasharray: '3 3', visible: visibleLines.includes('temp') },
        ]}
        axes={[
          { id: 'left', orientation: 'left', domain: [30, 90], label: 'Lärmpegel (dB)', ticks: [30, 40, 50, 60, 70, 80, 90] },
          { id: 'wind', orientation: 'right', domain: [0, 25], label: 'Windgeschwindigkeit (km/h)', ticks: [0, 5, 10, 15, 20, 25] },
        ]}
        thresholds={[
          { value: thresholds.warning, label: 'Warnung', color: CHART_COLORS.warning, yAxisId: 'noise' },
          { value: thresholds.alarm, label: 'Alarm', color: CHART_COLORS.alarm, yAxisId: 'noise' },
        ]}
        title={meta.name}
        icon={meta.icon}
        tooltipFormatter={(value, name) => {
          if (name === 'ws') return [`${value} km/h`, 'Windgeschwindigkeit']
          if (name === 'rh') return [`${value} %`, 'Luftfeuchte']
          if (name === 'las') return [`${value} dB`, 'Lärmpegel']
          if (name === 'temp') return [`${value}°C`, 'Temperatur']
          if (Number(value) === thresholds.warning) return [`${value} dB`, 'Warnung (Grenzwert)']
          if (Number(value) === thresholds.alarm) return [`${value} dB`, 'Alarm (Grenzwert)']
          if (!name) return [String(value), 'Wert']
          return [String(value), name]
        }}
      />
    </div>
  )
} 