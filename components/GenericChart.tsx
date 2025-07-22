import React, { useState, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from "recharts"
import { TooltipProvider, Tooltip as UITooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ArrowLeft, ArrowRight, Plus, Minus } from 'lucide-react'

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
  // Nur dB-Linien togglbar
  const dbLines = lines.filter(line => (line.yAxisId ?? 'left') === 'left')
  const windLines = lines.filter(line => line.yAxisId === 'wind')
  return (
    <div className="flex flex-wrap gap-4 mt-4 text-xs items-center justify-center">
      {dbLines.map(line => (
        <label
          key={line.key}
          className="flex items-center gap-1 cursor-pointer"
          onMouseEnter={() => setHoveredLineKey(line.key)}
          onMouseLeave={() => setHoveredLineKey(null)}
        >
          <input type="checkbox" checked={visibleLines[line.key]} onChange={() => toggleLine(line.key)} className="accent-emerald-500" aria-label={line.label} />
          <span className="w-3 h-3 rounded-full" style={{ background: line.color }}></span> {line.label}
        </label>
      ))}
      {windLines.map(line => (
        <span
          key={line.key}
          className="flex items-center gap-1"
          onMouseEnter={() => setHoveredLineKey(line.key)}
          onMouseLeave={() => setHoveredLineKey(null)}
        >
          <span className="w-3 h-3 rounded-full" style={{ background: line.color }}></span> {line.label}
        </span>
      ))}
      {thresholds.map(thr => (
        <span key={thr.label} className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ background: thr.color }}></span> {thr.label}
        </span>
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
  maxPointsDefault = 200,
  height = 350,
  tooltipFormatter,
}: GenericChartProps) {
  const [maxPoints, setMaxPoints] = useState<number>(maxPointsDefault)
  const [zoomRange, setZoomRange] = useState<{ start: number; end: number } | null>(null)
  const [hoveredLineKey, setHoveredLineKey] = useState<string | null>(null)
  const chartRef = useRef<any>(null)
  // Debug: Logge die Daten-Prop direkt am Anfang
  console.log('GenericChart data prop:', data);
  const filteredChartData = useMemo(() => {
    console.log('GenericChart filteredChartData input:', data);
    return maxPoints > 0 && data.length > maxPoints ? data.slice(-maxPoints) : data
  }, [data, maxPoints])
  const visibleData = useMemo(() => zoomRange ? filteredChartData.slice(zoomRange.start, zoomRange.end) : filteredChartData, [filteredChartData, zoomRange])

  // Debug: Logge die Daten und Linien, die an das Chart übergeben werden
  if (Array.isArray(data)) {
    const debugValues = data.map(d => ({ las: d.las, rh: d.rh, ws: d.ws, temp: d.temp }));
    console.log('GenericChart Werte:', debugValues);
    console.log('GenericChart lines:', lines);
    if (Array.isArray(data)) {
      const debugLas = data.map(d => d.las)
      console.log('GenericChart alle las-Werte:', debugLas)
    }
  }

  // Sichtbarkeit der Linien
  // Nur dB-Linien togglbar, Wind immer sichtbar
  const dbLines = lines.filter(line => (line.yAxisId ?? 'left') === 'left')
  const windLines = lines.filter(line => line.yAxisId === 'wind')
  const allVisibleLines = [...dbLines.map(l => l.key), ...windLines.map(l => l.key)]
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({})
  React.useEffect(() => {
    setVisibleLines(
      Object.fromEntries(dbLines.map(l => [l.key, l.visible !== false]).concat(windLines.map(l => [l.key, true])))
    )
  }, [lines])
  function toggleLine(key: string) {
    if (windLines.some(l => l.key === key)) return // Wind nicht togglbar
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
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={visibleData} ref={chartRef}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              {/* Linke Y-Achse immer anzeigen */}
              <YAxis
                yAxisId={leftAxis.id}
                orientation={leftAxis.orientation}
                domain={leftAxis.domain}
                tick={{ fontSize: 12, fill: '#fff' }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
                label={{ value: leftAxis.label, angle: -90, position: 'insideLeft', offset: 0, style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))', fontSize: 12 } }}
                allowDecimals={false}
                type="number"
                interval={0}
              />
              {/* Weitere Achsen */}
              {axes.filter(a => a.id !== 'left').map(axis => (
                <YAxis
                  key={axis.id}
                  yAxisId={axis.id}
                  orientation={axis.orientation || "left"}
                  domain={axis.domain}
                  ticks={axis.ticks}
                  tick={{ fontSize: 12, fill: '#fff' }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                  label={axis.label ? { value: axis.label, angle: axis.orientation === "right" ? 90 : -90, position: axis.orientation === "right" ? "insideRight" : "insideLeft", offset: 0, style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))', fontSize: 12 } } : undefined}
                  allowDecimals={false}
                  type="number"
                  interval={0}
                />
              ))}
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                  color: "hsl(var(--card-foreground))",
                }}
                formatter={tooltipFormatter || defaultTooltipFormatter}
              />
              {dbLines.map(line => visibleLines[line.key] && (
                <Line
                  key={line.key}
                  type={line.type || "monotone"}
                  dataKey={line.key}
                  stroke={line.color}
                  strokeWidth={hoveredLineKey === line.key ? 4 : 2}
                  strokeOpacity={hoveredLineKey && hoveredLineKey !== line.key ? 0.3 : 1}
                  dot={false}
                  activeDot={line.activeDotColor ? { r: 4, fill: line.activeDotColor } : undefined}
                  yAxisId={line.yAxisId}
                  strokeDasharray={line.strokeDasharray}
                  name={line.label}
                />
              ))}
              {windLines.map(line => (
                <Line
                  key={line.key}
                  type={line.type || "monotone"}
                  dataKey={line.key}
                  stroke={line.color}
                  strokeWidth={hoveredLineKey === line.key ? 4 : 2}
                  strokeOpacity={hoveredLineKey && hoveredLineKey !== line.key ? 0.3 : 1}
                  dot={false}
                  activeDot={line.activeDotColor ? { r: 4, fill: line.activeDotColor } : undefined}
                  yAxisId={line.yAxisId}
                  strokeDasharray={line.strokeDasharray}
                  name={line.label}
                />
              ))}
              {thresholds.map(thr => (
                <Line
                  key={thr.label}
                  type="monotone"
                  dataKey={() => thr.value}
                  stroke={thr.color}
                  strokeWidth={1}
                  strokeDasharray={thr.strokeDasharray || "3 3"}
                  dot={false}
                  yAxisId={thr.yAxisId}
                  name={thr.label}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {legend && (
          <ChartLegend lines={lines} visibleLines={visibleLines} toggleLine={toggleLine} thresholds={thresholds} setHoveredLineKey={setHoveredLineKey} />
        )}
      </div>
    </TooltipProvider>
  )
} 