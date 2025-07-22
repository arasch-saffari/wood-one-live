import React, { useState, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { TooltipProvider, Tooltip as UITooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ArrowLeft, ArrowRight, Plus, Minus } from 'lucide-react'
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartJsTooltip,
  Legend as ChartJsLegend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, ChartJsTooltip, ChartJsLegend);

// Typen für GenericChart
interface GenericChartLine {
  key: string;
  label: string;
  color: string;
  yAxisId?: string;
  strokeDasharray?: string;
  visible?: boolean;
  type?: "monotone" | "linear";
  activeDotColor?: string;
}
interface GenericChartAxis {
  id: string;
  orientation: 'left' | 'right';
  domain: [number, number];
  label: string;
  ticks?: number[];
}
interface GenericChartThreshold {
  value: number;
  label: string;
  color: string;
  yAxisId?: string;
  strokeDasharray?: string;
}
interface GenericChartProps {
  data: Array<Record<string, unknown>>;
  lines: GenericChartLine[];
  axes: GenericChartAxis[];
  thresholds?: GenericChartThreshold[];
  legend?: boolean;
  height?: number;
  maxPointsDefault?: number;
  tooltipFormatter?: (value: unknown, name: string) => [string, string];
}

// Chart Controls Component
function ChartControls({ onZoomIn, onZoomOut, onPanLeft, onPanRight, canZoomIn, canZoomOut, canPanLeft, canPanRight }: {
  onZoomIn: () => void,
  onZoomOut: () => void,
  onPanLeft: () => void,
  onPanRight: () => void,
  canZoomIn: boolean,
  canZoomOut: boolean,
  canPanLeft: boolean,
  canPanRight: boolean,
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2 items-center my-4">
      <UITooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={onPanLeft} disabled={!canPanLeft} aria-label="Chart nach links schieben"><ArrowLeft className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Chart nach links schieben</TooltipContent></UITooltip>
      <UITooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={onZoomIn} disabled={!canZoomIn} aria-label="Hineinzoomen"><Plus className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>In das Chart hineinzoomen</TooltipContent></UITooltip>
      <UITooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={onZoomOut} disabled={!canZoomOut} aria-label="Zoom zurücksetzen"><Minus className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Zoom zurücksetzen</TooltipContent></UITooltip>
      <UITooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={onPanRight} disabled={!canPanRight} aria-label="Chart nach rechts schieben"><ArrowRight className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Chart nach rechts schieben</TooltipContent></UITooltip>
    </div>
  )
}

// Chart Legend Component
function ChartLegend({ lines, visibleLines, toggleLine, thresholds, setHoveredLineKey }: {
  lines: GenericChartLine[],
  visibleLines: Record<string, boolean>,
  toggleLine: (key: string) => void,
  thresholds: GenericChartThreshold[],
  setHoveredLineKey: (key: string | null) => void,
}) {
  return (
    <div className="flex flex-wrap gap-4 mt-4 text-xs items-center justify-center">
      {lines.map(line => (
        <label
          key={line.key}
          className="flex items-center gap-1 cursor-pointer"
          onMouseEnter={() => setHoveredLineKey(line.key)}
          onMouseLeave={() => setHoveredLineKey(null)}
        >
          <input type="checkbox" checked={!!visibleLines[line.key]} onChange={() => toggleLine(line.key)} className="accent-emerald-500" aria-label={line.label} />
          <span className="w-3 h-3 rounded-full" style={{ background: line.color }}></span> {line.label}
        </label>
      ))}
      {thresholds.map(thr => (
        <label key={thr.label} className="flex items-center gap-1 cursor-pointer"
          onMouseEnter={() => setHoveredLineKey(thr.label)}
          onMouseLeave={() => setHoveredLineKey(null)}
        >
          <input type="checkbox" checked={!!visibleLines[thr.label]} onChange={() => toggleLine(thr.label)} className="accent-yellow-500" aria-label={thr.label} />
          <span className="w-3 h-3 rounded-full" style={{ background: thr.color }}></span> {thr.label}
        </label>
      ))}
    </div>
  )
}

// Default Tooltip Formatter
function defaultTooltipFormatter(value: unknown, name: string): [string, string] {
  if (name.toLowerCase().includes('wind')) {
    const v = typeof value === 'number' ? value : Number(value)
    return [`${!isNaN(v) ? v.toFixed(1) : value} km/h`, 'Windgeschwindigkeit']
  }
  if (typeof value === 'number') return [`${value.toFixed(1)} dB`, name]
  return [String(value), name]
}

export function GenericChart({
  data,
  lines,
  axes,
  thresholds = [],
  legend = true,
  maxPointsDefault = 0,
  height = 350,
  tooltipFormatter,
}: GenericChartProps) {
  // Debug-Ausgabe: data Länge und erstes Element
  console.log("GenericChart data length:", Array.isArray(data) ? data.length : 'not array', "first:", Array.isArray(data) && data.length > 0 ? data[0] : 'empty');
  const [maxPoints, setMaxPoints] = useState<number>(maxPointsDefault)
  const [zoomRange, setZoomRange] = useState<{ start: number; end: number } | null>(null)
  const [hoveredLineKey, setHoveredLineKey] = useState<string | null>(null)
  const chartRef = useRef<HTMLCanvasElement | null>(null)
  const filteredChartData = useMemo(() => {
    return maxPoints > 0 && data.length > maxPoints ? data.slice(-maxPoints) : data
  }, [data, maxPoints])
  const visibleData = useMemo(() => zoomRange ? filteredChartData.slice(zoomRange.start, zoomRange.end) : filteredChartData, [filteredChartData, zoomRange])

  // Sichtbarkeit aller Linien und Schwellenwerte
  const allKeys = [...lines.map(l => l.key), ...thresholds.map(t => t.label)]
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({})
  React.useEffect(() => {
    setVisibleLines(
      Object.fromEntries(allKeys.map(k => [k, true]))
    )
  }, [allKeys.join(",")])
  function toggleLine(key: string) {
    setVisibleLines(v => ({ ...v, [key]: !v[key] }))
  }

  // Controls Logic
  const canZoomIn = visibleData.length > 10
  const canZoomOut = !!zoomRange
  const canPanLeft = !!zoomRange && zoomRange.start > 0
  const canPanRight = !!zoomRange && zoomRange.end < filteredChartData.length

  // Immer linke Y-Achse für dB anzeigen
  const leftAxis = axes.find(a => a.id === 'left') || { id: 'left', orientation: 'left' as const, domain: [30, 85] as [number, number], label: 'dB' }

  return (
    <TooltipProvider>
      <div className="space-y-4 lg:space-y-6">
        <ChartControls
          onZoomIn={canZoomIn ? () => setZoomRange(zoomRange ? { start: zoomRange.start + Math.floor((zoomRange.end - zoomRange.start) / 4), end: zoomRange.end - Math.floor((zoomRange.end - zoomRange.start) / 4) } : { start: Math.max(0, filteredChartData.length - 50), end: filteredChartData.length }) : () => {}}
          onZoomOut={canZoomOut ? () => setZoomRange(null) : () => {}}
          onPanLeft={canPanLeft ? () => setZoomRange(zoomRange ? { start: Math.max(0, zoomRange.start - (zoomRange.end - zoomRange.start) / 2), end: Math.max(zoomRange.end - (zoomRange.end - zoomRange.start) / 2, zoomRange.start) } : null) : () => {}}
          onPanRight={canPanRight ? () => setZoomRange(zoomRange ? { start: Math.min(filteredChartData.length - (zoomRange.end - zoomRange.start), zoomRange.start + (zoomRange.end - zoomRange.start) / 2), end: Math.min(filteredChartData.length, zoomRange.end + (zoomRange.end - zoomRange.start) / 2) } : null) : () => {}}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          canPanLeft={canPanLeft}
          canPanRight={canPanRight}
        />
        <div style={{ height }}>
          <Line
            data={{
              labels: visibleData.map((d: any) => d.time),
              datasets: lines.filter(line => visibleLines[line.key]).map(line => ({
                label: line.label,
                data: visibleData.map((d: any) => d[line.key]),
                borderColor: line.color,
                backgroundColor: line.color,
                borderWidth: hoveredLineKey === line.key ? 4 : 2,
                borderDash: line.strokeDasharray ? line.strokeDasharray.split(' ').map(Number) : undefined,
                yAxisID: line.yAxisId || 'left',
                pointRadius: 0,
                tension: 0.3,
              })),
              // Thresholds als zusätzliche Datasets (optional)
              ...thresholds && thresholds.length > 0 ? {
                datasets: [
                  ...lines.filter(line => visibleLines[line.key]).map(line => ({
                    label: line.label,
                    data: visibleData.map((d: any) => d[line.key]),
                    borderColor: line.color,
                    backgroundColor: line.color,
                    borderWidth: hoveredLineKey === line.key ? 4 : 2,
                    borderDash: line.strokeDasharray ? line.strokeDasharray.split(' ').map(Number) : undefined,
                    yAxisID: line.yAxisId || 'left',
                    pointRadius: 0,
                    tension: 0.3,
                  })),
                  ...thresholds.filter(thr => visibleLines[thr.label]).map(thr => ({
                    label: thr.label,
                    data: visibleData.map(() => thr.value),
                    borderColor: thr.color,
                    borderWidth: 1,
                    borderDash: thr.strokeDasharray ? thr.strokeDasharray.split(' ').map(Number) : [3, 3],
                    pointRadius: 0,
                    fill: false,
                    yAxisID: thr.yAxisId || 'left',
                    tension: 0,
                  })),
                ]
              } : {}
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: legend },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      if (tooltipFormatter) {
                        const [val, label] = tooltipFormatter(context.parsed.y, context.dataset.label || '')
                        return `${label}: ${val}`
                      }
                      return `${context.dataset.label}: ${context.parsed.y}`
                    }
                  }
                },
                title: { display: false },
              },
              scales: {
                left: {
                  type: 'linear',
                  position: 'left',
                  min: axes.find(a => a.id === 'left')?.domain[0],
                  max: axes.find(a => a.id === 'left')?.domain[1],
                  title: { display: !!axes.find(a => a.id === 'left')?.label, text: axes.find(a => a.id === 'left')?.label },
                  grid: { color: 'rgba(200,200,200,0.1)' },
                },
                ...axes.filter(a => a.id !== 'left').reduce((acc, axis) => {
                  acc[axis.id] = {
                    type: 'linear',
                    position: axis.orientation,
                    min: axis.domain[0],
                    max: axis.domain[1],
                    title: { display: !!axis.label, text: axis.label },
                    grid: { color: 'rgba(200,200,200,0.1)' },
                  }
                  return acc
                }, {} as any)
              },
              animation: false,
            }}
            height={height}
          />
        </div>
        {legend && (
          <ChartLegend lines={lines} visibleLines={visibleLines} toggleLine={toggleLine} thresholds={thresholds} setHoveredLineKey={setHoveredLineKey} />
        )}
      </div>
    </TooltipProvider>
  )
} 