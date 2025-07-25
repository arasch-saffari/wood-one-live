"use client";
import React, { useEffect, useState } from 'react'
import { useStationData, StationDataPoint } from "@/hooks/useStationData"
import { Badge } from "@/components/ui/badge"
import { MapPin, Music, Volume2, BarChart3 } from "lucide-react"
import { STATION_COLORS } from "@/lib/colors"
import ChartPlayground from '@/components/ChartPlayground'
import { useConfig } from "@/hooks/useConfig"
import { KpiCard } from "@/components/KpiCard"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { GlobalLoader } from "@/components/GlobalLoader"

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

// WeatherKpiCard-Komponente
export function WeatherKpiCard({ value, direction }: { value: number | string | undefined, direction: string }) {
  const displayValue = typeof value === 'number' ? value : (value ?? 'keine daten');
  return (
    <KpiCard
      icon={<BarChart3 className="w-5 h-5 text-purple-500" />}
      value={displayValue}
      unit="km/h"
      label="Windgeschwindigkeit"
      color="text-purple-500"
    >
      <div className="text-xs text-gray-500 mt-1">Windrichtung: {direction}</div>
    </KpiCard>
  );
}

export function StationDashboardPage({ station }: StationDashboardPageProps) {
  const meta = STATION_META[station]
  // Chart: Nur die letzten 500 minütlichen Mittelwerte laden
  const CHART_PAGE_SIZE = 500
  const [chartPage, setChartPage] = React.useState(1)
  const { data: chartData, totalCount: chartTotal, loading: dataLoading } = useStationData(station, "24h", 60000, chartPage, CHART_PAGE_SIZE, "15min")
  React.useEffect(() => {
    setChartPage(Math.max(1, Math.ceil(chartTotal / CHART_PAGE_SIZE)))
  }, [chartTotal])
  const { config: globalConfig } = useConfig();
  
  const [kpi, setKpi] = useState<{ max?: number; avg?: number; trend?: number } | null>(null)
  useEffect(() => {
    async function fetchKpi() {
      const res = await fetch(`/api/station-data?station=${station}&interval=24h&aggregate=kpi`)
      if (res.ok) {
        setKpi(await res.json())
      }
    }
    fetchKpi()
    // SSE-Integration für Delta-Updates
    const es = new EventSource('/api/updates')
    es.addEventListener('update', () => {
      fetchKpi()
    })
    return () => {
      es.close()
    }
  }, [station])

  // Show loading state while config or data is loading
  if (!globalConfig || dataLoading) {
    return (
      <GlobalLoader 
        text="Dashboard wird geladen ..." 
        icon={meta.icon}
      />
    )
  }
  // KPIs
  const current: number = typeof chartData[chartData.length - 1]?.las === 'number' ? chartData[chartData.length - 1].las : 0
  function safeInt(val: number | undefined): string {
    return typeof val === 'number' && isFinite(val) ? String(Math.round(val)) : '–'
  }
  const avg24h = safeInt(kpi?.avg)
  const max24h = safeInt(kpi?.max)
  const trend = safeInt(kpi?.trend)
  const maxData = chartData.length > 0 ? chartData.reduce((max, d) => (typeof d.las === 'number' && d.las > max.las ? d : max), chartData[0]) : undefined
  const maxTime = maxData && maxData.datetime ? new Date(maxData.datetime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–'
  const currentWind = typeof chartData[chartData.length - 1]?.ws === 'number' ? chartData[chartData.length - 1].ws : 'keine daten'
  const windDirectionRaw = chartData[chartData.length - 1]?.wd
  const windDirection = windDirectionRaw === null || windDirectionRaw === undefined || windDirectionRaw === '' ? '–' : windDirectionText(windDirectionRaw)
  // Schwellenwerte
  function getDynamicThresholds(config: unknown, station: string, chartData: StationDataPoint[]): ThresholdBlock {
    if (
      !config ||
      typeof config !== 'object' ||
      !('thresholdsByStationAndTime' in config) ||
      !chartData.length
    ) {
      return { warning: 55, alarm: 60, las: 50, laf: 52, from: "00:00", to: "23:59" }
    }
    const thresholdsConfig = config as { thresholdsByStationAndTime: Record<string, ThresholdBlock[]> }
    const now = chartData[chartData.length - 1]?.datetime?.slice(11, 16)
    const blocks: ThresholdBlock[] = thresholdsConfig.thresholdsByStationAndTime[station]
    if (!blocks) return { warning: 55, alarm: 60, las: 50, laf: 52, from: "00:00", to: "23:59" }
    const currentBlock = blocks.find((b: ThresholdBlock) => {
      if (!b.from || !b.to || !now) return false
      if (b.from < b.to) {
        return now >= b.from && now < b.to
      } else {
        return now >= b.from || now < b.to
      }
    })
    return currentBlock || { warning: 55, alarm: 60, las: 50, laf: 52, from: "00:00", to: "23:59" }
  }
  const thresholds = getDynamicThresholds(globalConfig, station, chartData)
  // Status-/Alarm-Box
  let status: 'normal' | 'warn' | 'alarm' = 'normal'
  if (current >= thresholds.alarm) status = 'alarm'
  else if (current >= thresholds.warning) status = 'warn'
  const statusBox = {
    normal: {
      title: 'Lärmpegel im Normalbereich',
      text: `Aktueller Pegel: ${Math.round(Number(current))} dB. Keine Grenzwertüberschreitung.`
    },
    warn: {
      title: 'Warnung: Lärmpegel erhöht',
      text: `Pegel liegt im Warnbereich (${Math.round(Number(current))} dB). Windrichtung: ${windDirection} bei ${currentWind} km/h.`
    },
    alarm: {
      title: 'Alarm: Hoher Lärmpegel',
      text: `Pegel überschreitet Alarmgrenzwert (${Math.round(Number(current))} dB). Windrichtung: ${windDirection} bei ${currentWind} km/h.`
    }
  }[status]
  const getStatusBadge = (level: number) => {
    if (level >= thresholds.alarm) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Alarm</Badge>
    if (level >= thresholds.warning) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warnung</Badge>
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Normal</Badge>
  }
  return (
    <div className="space-y-10 p-4 md:p-8">
      {/* Header & KPI Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            {meta.icon}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{meta.name}</h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">Echtzeit-Messdaten</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 md:items-end">
          {getStatusBadge(current)}
        </div>
      </div>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 md:mb-10">
        <KpiCard
          icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
          value={typeof current === 'number' ? Math.round(current) : '–'}
          unit="dB"
          label="Aktueller Pegel"
          color="text-blue-500"
        />
        <KpiCard
          icon={<BarChart3 className="w-5 h-5 text-cyan-500" />}
          value={avg24h}
          unit="dB"
          label="24h Durchschnitt"
          color="text-cyan-500"
        >
          <div className="flex items-center mt-1">
            <span className="text-xs text-cyan-500">{trend !== '–' && !isNaN(Number(trend)) && Number(trend) > 0 ? '+' : ''}{trend !== '–' ? trend : '–'}% vs gestern</span>
          </div>
        </KpiCard>
        <KpiCard
          icon={<BarChart3 className="w-5 h-5 text-red-400" />}
          value={typeof max24h === 'number' ? max24h : '–'}
          unit="dB"
          label="24h Spitze"
          color="text-red-400"
        >
          <div className="text-xs text-gray-500 mt-1">um {maxTime} Uhr</div>
        </KpiCard>
        <WeatherKpiCard value={currentWind} direction={windDirection} />
      </div>
      {/* Status-/Alarm-Box */}
      <div className="mb-8">
        <Card className="rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className={
              `text-base font-bold ` +
              (status === 'alarm' ? 'text-red-500' : status === 'warn' ? 'text-yellow-500' : 'text-emerald-500')
            }>{statusBox.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={
              `text-sm ` +
              (status === 'alarm' ? 'text-red-500' : status === 'warn' ? 'text-yellow-500' : 'text-emerald-500')
            }>{statusBox.text}</div>
          </CardContent>
        </Card>
      </div>
      {/* Chart */}
      <div className="mb-10 w-full">
        <ChartPlayground
          data={chartData.map(d => ({ time: d.time, las: d.las }))}
          lines={[
            { key: 'las', label: 'Lärmpegel (15min Mittelwert)', color: meta.chartColor as unknown as string, yAxisId: 'left', visible: true },
          ]}
          axes={[
            { id: 'left', orientation: 'left', domain: [30, 90], label: 'Lärmpegel (dB)', ticks: [30, 40, 50, 60, 70, 80, 90] },
          ]}
          thresholds={[
            { value: thresholds.warning, label: 'Warnung', color: '#facc15', yAxisId: 'left' },
            { value: thresholds.alarm, label: 'Alarm', color: '#ef4444', yAxisId: 'left' },
          ]}
          title=""
          icon={null}
          tooltipFormatter={(value, name) => {
            // Fange alle nicht-numerischen Fälle ab
            if (value === undefined || value === null) return ['–', name || 'Wert'];
            if (typeof value === 'object') return ['–', name || 'Wert'];
            if (Array.isArray(value)) return ['–', name || 'Wert'];
            if (typeof value === 'number' && !isFinite(value)) return ['–', name || 'Wert'];
            const rounded = typeof value === 'number' ? Math.round(value) : value;
            if (name === 'ws') return [`${rounded} km/h`, 'Windgeschwindigkeit'];
            if (name === 'rh') return [`${rounded} %`, 'Luftfeuchte'];
            if (name === 'las') return [`${rounded} dB`, 'Lärmpegel'];
            if (name === 'temp') return [`${rounded}°C`, 'Temperatur'];
            if (typeof rounded === 'number' && rounded === thresholds.warning) return [`${rounded} dB`, 'Warnung (Grenzwert)'];
            if (typeof rounded === 'number' && rounded === thresholds.alarm) return [`${rounded} dB`, 'Alarm (Grenzwert)'];
            if (!name) return [String(rounded), 'Wert'];
            return [String(rounded), name];
          }}
        />
      </div>
      {/* Exakte Tabellenansicht wie im All-Dashboard, aber für eine Station */}
    </div>
  )
} 