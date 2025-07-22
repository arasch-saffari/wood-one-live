import { useState, useRef } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from "recharts"
import { TooltipProvider, Tooltip as UITooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

export interface GenericChartLine {
  key: string
  label: string
  color: string
  yAxisId?: string
  strokeDasharray?: string
  activeDotColor?: string
  visible?: boolean
  type?: "monotone" | "linear"
}

export interface GenericChartAxis {
  id: string
  orientation?: "left" | "right"
  domain?: [number, number]
  label?: string
  ticks?: number[]
  unit?: string
}

export interface GenericChartThreshold {
  value: number
  label: string
  color: string
  yAxisId?: string
  strokeDasharray?: string
}

export interface GenericChartProps {
  data: any[]
  lines: GenericChartLine[]
  axes: GenericChartAxis[]
  thresholds?: GenericChartThreshold[]
  legend?: boolean
  maxPointsDefault?: number
  height?: number | string
  tooltipFormatter?: (value: any, name: string) => [string, string]
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
  const chartRef = useRef<any>(null)
  const filteredChartData = maxPoints > 0 && data.length > maxPoints ? data.slice(-maxPoints) : data
  const visibleData = zoomRange ? filteredChartData.slice(zoomRange.start, zoomRange.end) : filteredChartData

  // Zoom/Pan Controls
  const handleZoomIn = () => {
    if (!zoomRange) setZoomRange({ start: Math.max(0, filteredChartData.length - 50), end: filteredChartData.length })
    else {
      const size = zoomRange.end - zoomRange.start
      if (size > 10) setZoomRange({ start: zoomRange.start + Math.floor(size / 4), end: zoomRange.end - Math.floor(size / 4) })
    }
  }
  const handleZoomOut = () => setZoomRange(null)
  const handlePanLeft = () => {
    if (!zoomRange) return
    const size = zoomRange.end - zoomRange.start
    setZoomRange({ start: Math.max(0, zoomRange.start - size / 2), end: Math.max(size, zoomRange.end - size / 2) })
  }
  const handlePanRight = () => {
    if (!zoomRange) return
    const size = zoomRange.end - zoomRange.start
    setZoomRange({ start: Math.min(filteredChartData.length - size, zoomRange.start + size / 2), end: Math.min(filteredChartData.length, zoomRange.end + size / 2) })
  }

  // Sichtbarkeit der Linien
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>(
    Object.fromEntries(lines.map(l => [l.key, l.visible !== false]))
  )
  function toggleLine(key: string) {
    setVisibleLines(v => ({ ...v, [key]: !v[key] }))
  }

  return (
    <TooltipProvider>
      <div className="space-y-4 lg:space-y-6">
        {/* Chart Controls */}
        <div className="flex justify-center gap-2 items-center my-4 flex-wrap">
          <UITooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={handlePanLeft} disabled={!zoomRange || zoomRange.start === 0}>
                ←
              </Button>
            </TooltipTrigger>
            <TooltipContent>Chart nach links schieben</TooltipContent>
          </UITooltip>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={handleZoomIn} disabled={visibleData.length <= 10}>
                ＋
              </Button>
            </TooltipTrigger>
            <TooltipContent>In das Chart hineinzoomen</TooltipContent>
          </UITooltip>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={handleZoomOut} disabled={!zoomRange}>
                🗖
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom zurücksetzen</TooltipContent>
          </UITooltip>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={handlePanRight} disabled={!zoomRange || zoomRange.end === filteredChartData.length}>
                →
              </Button>
            </TooltipTrigger>
            <TooltipContent>Chart nach rechts schieben</TooltipContent>
          </UITooltip>
        </div>
        <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl">
          <CardHeader />
          <CardContent>
            <div style={{ height }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={visibleData} ref={chartRef}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  {axes.map(axis => (
                    <YAxis
                      key={axis.id}
                      yAxisId={axis.id}
                      orientation={axis.orientation || "left"}
                      domain={axis.domain}
                      ticks={axis.ticks}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
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
                    formatter={tooltipFormatter}
                  />
                  {lines.map(line => visibleLines[line.key] && (
                    <Line
                      key={line.key}
                      type={line.type || "monotone"}
                      dataKey={line.key}
                      stroke={line.color}
                      strokeWidth={2}
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
          </CardContent>
        </Card>
        {legend && (
          <div className="flex flex-wrap gap-4 mt-4 text-xs items-center justify-center">
            {lines.map(line => (
              <label key={line.key} className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={visibleLines[line.key]} onChange={() => toggleLine(line.key)} className="accent-emerald-500" />
                <span className="w-3 h-3 rounded-full" style={{ background: line.color }}></span> {line.label}
              </label>
            ))}
            {thresholds.map(thr => (
              <span key={thr.label} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full" style={{ background: thr.color }}></span> {thr.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
} 