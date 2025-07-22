"use client";
import React, { useState } from 'react';
import { GenericChart } from '@/components/GenericChart';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { ReactNode } from 'react';

const granularities = ['1h', '15min', '10min', '5min', '1min']
const pointOptions = [50, 100, 200, 500, 0]

function generateDemoData(len = 30) {
  return Array.from({ length: len }).map((_, i) => ({
    time: `${String(i).padStart(2, '0')}:00`,
    ort: 50 + Math.sin(i / 5) * 5 + Math.random() * 2,
    windSpeed: 10 + Math.sin(i / 8) * 3 + Math.random() * 1.5,
  }))
}

// Typen für ChartPlayground
interface ChartLine {
  key: string;
  label: string;
  color: string;
  yAxisId?: string;
  strokeDasharray?: string;
  visible?: boolean;
}
interface ChartAxis {
  id: string;
  orientation: 'left' | 'right';
  domain: [number, number];
  label: string;
  ticks?: number[];
}
interface ChartThreshold {
  value: number;
  label: string;
  color: string;
  yAxisId?: string;
}
interface ChartPlaygroundProps {
  data: Array<Record<string, any>>;
  lines: ChartLine[];
  axes: ChartAxis[];
  title?: string;
  icon?: React.ReactNode;
  interval?: string;
  onIntervalChange?: (val: string) => void;
  granularity?: string;
  onGranularityChange?: (val: string) => void;
  maxPoints?: number;
  onMaxPointsChange?: (val: number) => void;
  thresholds?: ChartThreshold[];
  tooltipFormatter?: (value: any, name: string) => [string, string];
}

export function ChartPlayground({
  data: dataProp,
  lines: linesProp,
  axes: axesProp,
  title = 'Ort',
  icon = <BarChart3 className="w-5 h-5 text-blue-500" />,
  interval: intervalProp,
  onIntervalChange,
  granularity: granularityProp,
  onGranularityChange,
  maxPoints: maxPointsProp,
  onMaxPointsChange,
  thresholds,
  tooltipFormatter,
}: ChartPlaygroundProps) {
  const { config } = useConfig();
  const intervals = config?.allowedIntervals || ['12h', '24h', '48h', '5d', '7d'];
  // Initialisiere die States so, dass sie nie undefined sind
  const intervalsList = intervals.length > 0 ? intervals : ['24h']
  const [interval, setInterval] = useState(intervalProp || intervalsList[0])
  const [granularity, setGranularity] = useState(granularityProp || granularities[0])
  const [maxPoints, setMaxPoints] = useState(maxPointsProp ?? 288)
  let data = dataProp ?? generateDemoData();
  // Fallback: las immer laf bevorzugen, falls vorhanden
  if (Array.isArray(data)) {
    data = data.map(d => ({ ...d, las: d.laf ?? d.las ?? d.las }));
  }

  // Stelle sicher, dass die Daten aufsteigend nach Zeit sortiert sind
  const sortedData = useState(() => {
    if (!Array.isArray(data)) return data
    // Versuche nach datetime oder time zu sortieren
    return [...data].sort((a, b) => {
      const tA = (a.datetime || a.time)
      const tB = (b.datetime || b.time)
      if (!tA || !tB) return 0
      return tA.localeCompare(tB)
    })
  })[0]

  // Debug-Ausgabe: sortedData Länge und erstes Element
  console.log("ChartPlayground sortedData length:", Array.isArray(sortedData) ? sortedData.length : 'not array', "first:", Array.isArray(sortedData) && sortedData.length > 0 ? sortedData[0] : 'empty');

  const lines = linesProp ?? [
    { key: 'las', label: 'Lärmpegel', color: '#10b981', yAxisId: 'noise' },
    { key: 'ws', label: 'Wind', color: '#06b6d4', yAxisId: 'wind', strokeDasharray: '5 5' },
    { key: 'rh', label: 'Luftfeuchte', color: '#10b981', yAxisId: 'noise', strokeDasharray: '2 2' },
  ];
  const axes = axesProp ?? [
    { id: 'noise', orientation: 'left' as const, domain: [30, 95] as [number, number], label: 'Lärmpegel (dB)', ticks: [30, 40, 50, 60, 70, 80, 90] },
    { id: 'wind', orientation: 'right' as const, domain: [0, 25] as [number, number], label: 'Windgeschwindigkeit (km/h)', ticks: [0, 5, 10, 15, 20, 25] },
  ];
  const defaultThresholds = [
    { value: 55, label: 'Warnung', color: '#facc15', yAxisId: 'noise' },
    { value: 60, label: 'Alarm', color: '#f87171', yAxisId: 'noise' },
  ];

  // Prop-Handler synchronisieren
  const handleIntervalChange = (v: string) => {
    setInterval(v);
    onIntervalChange?.(v);
  };
  const handleGranularityChange = (v: string) => {
    setGranularity(v);
    onGranularityChange?.(v);
  };
  const handleMaxPointsChange = (v: string) => {
    const num = Number(v)
    setMaxPoints(num)
    onMaxPointsChange?.(num)
    console.log('[ChartPlayground] handleMaxPointsChange: maxPoints =', num)
  }

  // Debug-Ausgabe für maxPoints bei jedem Render
  React.useEffect(() => {
    console.log('[ChartPlayground] aktueller maxPoints:', maxPoints)
  }, [maxPoints])

  return (
    <Card className="mb-6 rounded-lg shadow-sm border border-card bg-card text-card-foreground">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-lg font-bold">{title}</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          {/* Zeitraum-Auswahl */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold mr-2" title="Datenzeitraum">Zeitraum:</span>
            <Select value={interval || intervalsList[0]} onValueChange={handleIntervalChange}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {intervals.map((int: string) => (
                  <SelectItem key={int} value={int}>{int}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Granularität-Auswahl */}
          <div className="flex items-center gap-2 overflow-x-auto md:gap-2 md:overflow-visible pb-2 md:pb-0">
            <span className="text-xs font-semibold mr-2 shrink-0" title="Wie fein die Messpunkte sind">Granularität:</span>
            <Select value={granularity || granularities[0]} onValueChange={handleGranularityChange}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {granularities.map(gran => (
                  <SelectItem key={gran} value={gran}>{gran}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Anzahl Punkte-Auswahl */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold mr-2" title="Wie viele Datenpunkte im Chart angezeigt werden">Anzahl Punkte:</span>
            <Select value={String(maxPoints)} onValueChange={v => { handleMaxPointsChange(v); console.log('[ChartPlayground Select] onValueChange:', v, 'typeof:', typeof v); }}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {pointOptions.map(val => (
                  <SelectItem key={val} value={String(val)}>{val === 0 ? 'Alle' : val}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Chart */}
        <GenericChart
          data={sortedData}
          lines={lines}
          axes={axes}
          thresholds={thresholds ?? defaultThresholds}
          legend={true}
          height={400}
          maxPointsDefault={maxPoints}
          tooltipFormatter={tooltipFormatter}
        />
      </CardContent>
    </Card>
  );
} 