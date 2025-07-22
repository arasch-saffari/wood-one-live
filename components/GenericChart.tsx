import React, { useState, useRef, useMemo } from "react"
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
  tooltipFormatter?: (value: unknown, name: string) => [string, string];
}

export function GenericChart({
  data,
  lines,
  axes,
  thresholds = [],
  legend = true,
  height = 350,
  tooltipFormatter,
}: GenericChartProps) {
  // Sichtbarkeit aller Linien und Schwellenwerte
  const allKeys = useMemo(() => [...lines.map(l => l.key), ...thresholds.map(t => t.label)], [lines, thresholds]);
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>(() => Object.fromEntries(allKeys.map(k => [k, true])));
  const prevKeysRef = useRef<string[]>(allKeys);
  React.useEffect(() => {
    const prev = prevKeysRef.current;
    if (prev.length !== allKeys.length || !prev.every((k, i) => k === allKeys[i])) {
      setVisibleLines(Object.fromEntries(allKeys.map(k => [k, true])));
      prevKeysRef.current = allKeys;
    }
  }, [allKeys]);
  const [hoveredLineKey, setHoveredLineKey] = React.useState<string | null>(null);
  const toggleLine = React.useCallback((key: string) => {
    setVisibleLines(v => ({ ...v, [key]: !v[key] }));
  }, []);
  // Chart-Daten vorbereiten
  const visibleData = React.useMemo(() => Array.isArray(data) ? data : [], [data]);
  // Chart.js Datasets
  const chartDatasets = React.useMemo(() => [
    ...lines.filter(line => visibleLines[line.key]).map(line => ({
      label: line.label,
      data: visibleData.map((d) => typeof d[line.key] === 'number' ? d[line.key] as number : null),
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
  ], [lines, thresholds, visibleLines, visibleData, hoveredLineKey]);
  // Chart.js Optionen
  const chartOptions = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: legend },
      tooltip: {
        callbacks: {
          label: function(context: { parsed: { y: number }, dataset: { label?: string } }) {
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
        type: 'linear' as const,
        position: 'left' as const,
        min: axes.find(a => a.id === 'left')?.domain[0],
        max: axes.find(a => a.id === 'left')?.domain[1],
        title: { display: !!axes.find(a => a.id === 'left')?.label, text: axes.find(a => a.id === 'left')?.label },
        grid: { color: 'rgba(200,200,200,0.1)' },
      },
      ...axes.filter(a => a.id !== 'left').reduce((acc, axis) => {
        acc[axis.id] = {
          type: 'linear' as const,
          position: axis.orientation as 'left' | 'right',
          min: axis.domain[0],
          max: axis.domain[1],
          title: { display: !!axis.label, text: axis.label },
          grid: { color: 'rgba(200,200,200,0.1)' },
        };
        return acc;
      }, {} as Record<string, unknown>),
    },
    animation: false as const,
  }), [legend, tooltipFormatter, axes]);
  return (
    <div className="space-y-4 lg:space-y-6">
      <div style={{ height }}>
        <Line
          data={{
            labels: visibleData.map((d) => typeof d.time === 'string' ? d.time : ''),
            datasets: chartDatasets,
          }}
          options={chartOptions}
          height={height}
        />
      </div>
      {legend && (
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
      )}
    </div>
  );
} 