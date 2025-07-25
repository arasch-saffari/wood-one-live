"use client";
import React, { useRef, useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Chart,
  TooltipItem,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface GenericChartLine {
  key: string;
  label: string;
  color: string;
  yAxisId?: string;
}
interface GenericChartAxis {
  id: string;
  orientation: "left" | "right";
  domain: [number, number];
  label: string;
  ticks?: number[];
}
interface GenericChartThreshold {
  value: number;
  label: string;
  color: string;
  yAxisId?: string;
}
type GenericChartProps = {
  data: any[]
  lines: any[]
  axes: any[]
  thresholds?: any[]
  legend?: boolean
  height?: number
  tooltipFormatter?: {
    label?: (ctx: any) => string | string[]
    [key: string]: any
  }
}

const GenericChartInner = ({
  data,
  lines,
  axes,
  thresholds = [],
  legend = true,
  height = 400,
  tooltipFormatter,
}: GenericChartProps) => {
  const chartRef = useRef<Chart<"line"> | null>(null);
  const zoomRegistered = { current: false };

  // chartjs-plugin-zoom temporär entfernt

  // User-Auswahl: wie viele Datenpunkte anzeigen
  const [showAll, setShowAll] = useState(false);
  const [maxPoints, setMaxPoints] = useState(60);
  // Performance: Wenn mehr als 500 Datenpunkte, nur die letzten 500 anzeigen (Warnung)
  const maxPerformancePoints = 500;
  let slicedData = data;
  let performanceWarning = false;
  if (!showAll && data.length > maxPoints) {
    slicedData = data.slice(-maxPoints);
  } else if (showAll && data.length > maxPerformancePoints) {
    slicedData = data.slice(-maxPerformancePoints);
    performanceWarning = true;
  }

  // X-Achse: Zeit (datetime oder time)
  const labels = slicedData.map((d) => {
    if (typeof d.datetime === "string") return d.datetime.slice(11, 16);
    if (typeof d.time === "string") return d.time;
    if (d.datetime != null) return String(d.datetime);
    if (d.time != null) return String(d.time);
    return "";
  });
  // Multi-Line-Support: Erzeuge für jede line ein eigenes Dataset
  const datasets = lines.map((line) => ({
    label: line.label,
    data: slicedData.map((d) => (typeof d[line.key] === "number" ? d[line.key] : null)),
    borderColor: typeof line.color === 'string' ? line.color : '#6366f1',
    backgroundColor: typeof line.color === 'string' ? line.color : '#6366f1',
    borderWidth: 3,
    pointRadius: 3,
    fill: false,
    yAxisID: line.yAxisId || "left",
    tension: 0.35,
    borderCapStyle: "round" as const,
    cubicInterpolationMode: "monotone" as const,
    borderDash: line.strokeDasharray ? line.strokeDasharray.split(' ').map(Number) : undefined,
    hidden: line.visible === false,
  }))
  // Thresholds als zusätzliche Linien (immer auf yAxisId der ersten line oder "left")
  const thresholdDatasets = thresholds.map((thr) => ({
    label: thr.label,
    data: slicedData.map(() => thr.value),
    borderColor: typeof thr.color === 'string' ? thr.color : '#6366f1',
    backgroundColor: typeof thr.color === 'string' ? thr.color : '#6366f1',
    borderDash: [6, 6],
    borderWidth: 2,
    pointRadius: 0,
    fill: false,
    yAxisID: thr.yAxisId || (lines[0]?.yAxisId || "left"),
    tension: 0,
    borderCapStyle: "round" as const,
    cubicInterpolationMode: "monotone" as const,
    hidden: false,
    order: 100,
  }))
  datasets.push(...thresholdDatasets)
  // Achsen-Konfiguration
  const leftAxis = axes.find((a) => a.orientation === "left");
  // Farben für Light/Dark Mode
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const fg = isDark ? '#e5e7eb' : '#334155'; // slate-200/800
  const grid = isDark ? 'rgba(100,116,139,0.18)' : 'rgba(100,116,139,0.13)';
  const accent = isDark ? '#6366f1' : '#6366f1';
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 900,
      easing: 'easeOutQuart' as const,
    },
    plugins: {
      legend: {
        display: legend,
        labels: {
          color: fg,
          font: { size: 15, weight: 'bold' as const, family: 'var(--font-sans, Inter, ui-sans-serif, system-ui)' },
          boxWidth: 18,
          boxHeight: 18,
          padding: 18,
        },
        align: 'end' as const,
        position: 'top' as const,
        maxHeight: 48,
        maxWidth: 400,
        rtl: false,
        fullSize: false,
      },
      tooltip: {
        enabled: true,
        backgroundColor: isDark ? "rgba(24,24,32,0.98)" : "#fff",
        titleColor: fg,
        bodyColor: fg,
        borderColor: accent,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: tooltipFormatter ? tooltipFormatter : {
          label: (ctx: TooltipItem<'line'>) => {
            const line = datasets.find(ds => ds.label === ctx.dataset.label);
            const value = typeof ctx.parsed.y === 'number' ? Math.round(ctx.parsed.y) : ctx.parsed.y;
            if (line) {
              return ` ${line.label}: ${value} dB`;
            }
            return ` ${ctx.dataset.label}: ${value} dB`;
          },
        },
      },
      title: { display: false },
      // zoom: chartjs-plugin-zoom temporär entfernt
    },
    scales: {
      [leftAxis?.id || "left"]: {
        type: "linear" as const,
        position: "left" as const,
        min: leftAxis?.domain?.[0] ?? 30,
        max: leftAxis?.domain?.[1] ?? 90,
        title: {
          display: true,
          text: leftAxis?.label || "Lärmpegel (dB)",
          color: fg,
          font: { size: 15, weight: 'bold' as const, family: 'var(--font-sans, Inter, ui-sans-serif, system-ui)' },
        },
        ticks: {
          color: fg,
          font: { size: 13, family: 'var(--font-sans, Inter, ui-sans-serif, system-ui)' },
          stepSize: 10,
        },
        grid: {
          color: grid,
        },
      },
      x: {
        title: { display: false },
        ticks: {
          color: fg,
          font: { size: 13, family: 'var(--font-sans, Inter, ui-sans-serif, system-ui)' },
        },
        grid: {
          color: grid,
        },
      },
    },
  };
  // Export als PNG
  function handleExport() {
    if (chartRef.current) {
      const url = chartRef.current.toBase64Image();
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chart.png';
      a.click();
    }
  }
  // Fallback: Kein Chart, wenn keine Daten
  const hasData = labels.length > 0 && datasets.some(ds => Array.isArray(ds.data) && ds.data.some(v => v !== null && v !== undefined));
  return (
    <div style={{ height }} className="w-full bg-card rounded-xl shadow-lg p-4 md:p-8 relative flex flex-col">
      {/*
        Für sehr große Datenmengen (>2000 Punkte) empfiehlt sich echtes Downsampling oder Lazy Loading der Chartdaten.
        Siehe z.B. https://github.com/leeoniya/uPlot oder serverseitiges Downsampling.
      */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <button
            className="bg-muted text-xs px-3 py-1 rounded shadow hover:bg-accent transition z-10"
            onClick={handleExport}
            type="button"
            title="Chart als PNG exportieren"
          >
            Export PNG
          </button>
          <select
            className="bg-muted border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-accent ml-2"
            value={showAll ? 'all' : maxPoints}
            onChange={e => {
              if (e.target.value === 'all') setShowAll(true);
              else {
                setShowAll(false);
                setMaxPoints(Number(e.target.value));
              }
            }}
          >
            <option value={60}>Letzte 60</option>
            <option value={120}>Letzte 120</option>
            <option value={250}>Letzte 250</option>
            <option value={500}>Letzte 500</option>
            <option value="all">Alle</option>
          </select>
        </div>
        {performanceWarning && (
          <div className="text-xs text-yellow-600 font-semibold mt-2 md:mt-0">
            Achtung: Es werden nur die letzten 500 Datenpunkte angezeigt (Performance).
          </div>
        )}
      </div>
      <div className="flex-1 min-h-[250px]">
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Keine Daten für die ausgewählten Linien/Zeitpunkte vorhanden.</div>
        ) : (
          <Line
            ref={chartRef}
            data={{
              labels,
              datasets,
            }}
            options={options}
          />
        )}
      </div>
    </div>
  );
}

export const GenericChart = React.memo(GenericChartInner) 