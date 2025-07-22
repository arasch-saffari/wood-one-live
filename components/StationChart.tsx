import { GenericChart } from "@/components/GenericChart"
import { useState, useRef } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TooltipProvider, Tooltip as UITooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface StationChartProps {
  data: Record<string, unknown>[]
  thresholds: { warning: number; alarm: number }
  stationColors: { primary: string }
  chartColors: { wind: string; humidity: string; warning: string; alarm: string }
  stationName: string
  maxPointsDefault?: number
  granularities?: string[]
  intervals?: string[]
}

export function StationChart({
  data,
  thresholds,
  stationColors,
  chartColors,
  stationName,
  maxPointsDefault = 0,
  granularities = ["15min", "10min", "5min", "1min", "1h"],
  intervals = ["24h", "7d"],
}: StationChartProps) {
  // Konfiguriere Linien und Achsen für GenericChart
  const lines = [
    { key: "las", label: "Lärmpegel", color: stationColors.primary, yAxisId: "noise" },
    { key: "ws", label: "Wind", color: chartColors.wind, yAxisId: "wind", strokeDasharray: "5 5" },
    { key: "rh", label: "Luftfeuchte", color: chartColors.humidity, yAxisId: "noise", strokeDasharray: "2 2" },
  ]
  const axes = [
    { id: "noise", orientation: "left" as const, domain: [30, 95] as [number, number], label: "Lärmpegel (dB)", ticks: [30, 40, 50, 60, 70, 80, 90] },
    { id: "wind", orientation: "right" as const, domain: [0, 25] as [number, number], label: "Windgeschwindigkeit (km/h)", ticks: [0, 5, 10, 15, 20, 25] },
  ]
  const chartThresholds = [
    { value: thresholds.warning, label: "Warnung", color: chartColors.warning, yAxisId: "noise" },
    { value: thresholds.alarm, label: "Alarm", color: chartColors.alarm, yAxisId: "noise" },
  ]
  return (
    <GenericChart
      data={data}
      lines={lines}
      axes={axes}
      thresholds={chartThresholds}
      legend={true}
      maxPointsDefault={maxPointsDefault}
      height={350}
      tooltipFormatter={(value, name) => {
        if (name === "ws") return [`${value} km/h`, "Windgeschwindigkeit"]
        if (name === "rh") return [`${value} %`, "Luftfeuchte"]
        if (name === "las") return [`${value} dB`, "Lärmpegel"]
        if (name === "temp") return [`${value}°C`, "Temperatur"]
        if (Number(value) === thresholds.warning) return [`${value} dB`, "Warnung (Grenzwert)"]
        if (Number(value) === thresholds.alarm) return [`${value} dB`, "Alarm (Grenzwert)"]
        if (!name) return [String(value), "Wert"]
        return [String(value), name]
      }}
    />
  )
} 