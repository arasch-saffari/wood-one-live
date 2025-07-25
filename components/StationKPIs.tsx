import React from 'react'
import { KpiCard } from "@/components/KpiCard"
import { Volume2, TrendingUp, Wind } from "lucide-react"

interface StationKPIsProps {
  current: number
  avg24h: string | number
  max24h: number
  trend: string | number
  currentWind: number | string
  windDirection: string
  kpiColor: string
}

export function StationKPIs({ current, avg24h, max24h, trend, currentWind, windDirection, kpiColor }: StationKPIsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      <KpiCard
        icon={<Volume2 className={`w-3 lg:w-4 h-3 lg:h-4 text-${kpiColor}`} />}
        value={Math.round(Number(current))}
        unit="dB"
        label="Aktueller Pegel"
        color={`text-${kpiColor}`}
      />
      <KpiCard
        icon={<Volume2 className={`w-3 lg:w-4 h-3 lg:h-4 text-${kpiColor}`} />}
        value={Math.round(Number(avg24h))}
        unit="dB"
        label="24h Durchschnitt"
        color={`text-${kpiColor}`}
      >
        <div className="flex items-center mt-1">
          <TrendingUp className={`w-2 lg:w-3 h-2 lg:h-3 text-${kpiColor} mr-1`} />
          <span className={`text-xs text-${kpiColor}`}>{Number(trend) > 0 ? "+" : ""}{Math.round(Number(trend))}% vs gestern</span>
        </div>
      </KpiCard>
      <KpiCard
        icon={<TrendingUp className="w-3 lg:w-4 h-3 lg:h-4 text-red-400" />}
        value={Math.round(Number(max24h))}
        unit="dB"
        label="24h Spitze"
        color="text-red-400"
      >
        <div className="text-xs text-gray-500 mt-1">um 18:45 Uhr</div>
      </KpiCard>
      <KpiCard
        icon={<Wind className={`w-3 lg:w-4 h-3 lg:h-4 text-${kpiColor}`} />}
        value={currentWind != null ? currentWind : "keine daten"}
        unit="km/h"
        label="Windgeschwindigkeit"
        color={`text-${kpiColor}`}
      >
        <div className="text-xs text-gray-500 mt-1">Windrichtung: {windDirection}</div>
      </KpiCard>
    </div>
  )
} 