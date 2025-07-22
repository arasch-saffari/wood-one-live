"use client";
import React, { useState } from 'react';
import { GenericChart } from '@/components/GenericChart';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';

const granularities = ['1h', '15min', '10min', '5min', '1min'];
const pointOptions = [50, 100, 200, 500, 0];

interface ChartPlaygroundProps {
  data: Array<{ date: string; time: string; maxSPLAFast: number }>;
  title?: string;
  icon?: React.ReactNode;
  interval?: string;
  onIntervalChange?: (val: string) => void;
  granularity?: string;
  onGranularityChange?: (val: string) => void;
  maxPoints?: number;
  onMaxPointsChange?: (val: number) => void;
  thresholds?: { value: number; label: string; color: string; yAxisId?: string }[];
  tooltipFormatter?: (value: unknown, name: string) => [string, string];
}

export function ChartPlayground({
  data: dataProp,
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
  const intervalsList = intervals.length > 0 ? intervals : ['24h'];
  const [interval, setInterval] = useState(intervalProp || intervalsList[0]);
  const [granularity, setGranularity] = useState(granularityProp || granularities[0]);
  const [maxPoints, setMaxPoints] = useState(maxPointsProp ?? 288);
  const data = Array.isArray(dataProp) ? dataProp : [];

  const lines = [
    { key: 'maxSPLAFast', label: 'Max SPL A Fast', color: '#10b981', yAxisId: 'noise' },
  ];
  const axes = [
    { id: 'noise', orientation: 'left' as const, domain: [30, 120] as [number, number], label: 'Max SPL A Fast (dB)', ticks: [30, 50, 70, 90, 110] },
  ];
  const defaultThresholds = [
    { value: 55, label: 'Warnung', color: '#facc15', yAxisId: 'noise' },
    { value: 60, label: 'Alarm', color: '#f87171', yAxisId: 'noise' },
  ];

  const handleIntervalChange = (v: string) => {
    setInterval(v);
    onIntervalChange?.(v);
  };
  const handleGranularityChange = (v: string) => {
    setGranularity(v);
    onGranularityChange?.(v);
  };
  const handleMaxPointsChange = (v: string) => {
    const num = Number(v);
    setMaxPoints(num);
    onMaxPointsChange?.(num);
  };

  return (
    <Card className="mb-6 rounded-lg shadow-sm border border-card bg-card text-card-foreground">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-lg font-bold">{title}</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold mr-2" title="Wie viele Datenpunkte im Chart angezeigt werden">Anzahl Punkte:</span>
            <Select value={String(maxPoints)} onValueChange={v => { handleMaxPointsChange(v); }}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {pointOptions.map(val => (
                  <SelectItem key={val} value={String(val)}>{val === 0 ? 'Alle' : val}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <GenericChart
          data={data}
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