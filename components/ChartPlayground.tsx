"use client";
import React from 'react';
import { GenericChart } from '@/components/GenericChart';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

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
  data: Array<Record<string, unknown>>;
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
  tooltipFormatter?: (value: unknown, name: string) => [string, string];
}

export function ChartPlayground({
  data,
  lines,
  axes,
  title = 'Ort',
  icon = <BarChart3 className="w-5 h-5 text-blue-500" />,
  thresholds,
  tooltipFormatter,
}: ChartPlaygroundProps) {
  // Fallback: las immer laf bevorzugen, falls vorhanden
  if (Array.isArray(data)) {
    data = data.map(d => ({ ...d, las: d.laf ?? d.las ?? d.las }));
  }
  // Stelle sicher, dass die Daten aufsteigend nach Zeit sortiert sind
  const sortedData = Array.isArray(data)
    ? [...data].sort((a, b) => {
        const tA = typeof a.datetime === 'string' ? a.datetime : (typeof a.time === 'string' ? a.time : '')
        const tB = typeof b.datetime === 'string' ? b.datetime : (typeof b.time === 'string' ? b.time : '')
        if (!tA || !tB) return 0
        return tA.localeCompare(tB)
      })
    : data
  return (
    <Card className="mb-6 rounded-lg shadow-sm border border-card bg-card text-card-foreground">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-lg font-bold">{title}</span>
        </div>
        {/* Chart */}
        <GenericChart
          data={sortedData}
          lines={lines}
          axes={axes}
          thresholds={thresholds}
          legend={true}
          height={400}
          tooltipFormatter={tooltipFormatter}
        />
      </CardContent>
    </Card>
  );
} 