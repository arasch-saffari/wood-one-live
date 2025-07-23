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
// import zoomPlugin from "chartjs-plugin-zoom"; // Wird dynamisch importiert

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
interface GenericChartProps {
  data: Array<Record<string, unknown>>;
  lines: GenericChartLine[];
  axes: GenericChartAxis[];
  thresholds?: GenericChartThreshold[];
  legend?: boolean;
  height?: number;
}

export function GenericChart({
  data,
  lines,
  axes,
  thresholds = [],
  legend = true,
  height = 400,
}: GenericChartProps) {
  const chartRef = useRef<Chart<"line"> | null>(null);
  // Dynamischer Import von chartjs-plugin-zoom nur im Client
  useEffect(() => {
    (async () => {
      if (typeof window !== "undefined") {
        const mod = await import("chartjs-plugin-zoom");
        ChartJS.register(mod.default);
      }
    })();
  }, []);

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
  // Y-Daten: Lärmpegel
  const lasLine = lines.find((l) => l.key === "las");
  if (!lasLine) return null;
  const lasData = slicedData.map((d) => (typeof d.las === "number" ? d.las : null));
  // Schwellenwerte als zusätzliche Dataset-Linien
  const thresholdDatasets = thresholds.map((thr) => ({
    label: thr.label,
    data: slicedData.map(() => thr.value),
    borderColor: typeof thr.color === 'string' ? thr.color : '#6366f1',
    borderDash: [6, 6],
    borderWidth: 2,
    pointRadius: 0,
    fill: false,
    yAxisID: lasLine.yAxisId || "left",
    tension: 0,
    borderCapStyle: "round" as const,
  }));
  // Chart.js Dataset
  const datasets = [
    {
      label: lasLine.label,
      data: lasData,
      borderColor: typeof lasLine.color === 'string' ? lasLine.color : '#6366f1',
      backgroundColor: typeof lasLine.color === 'string' ? lasLine.color : '#6366f1',
      borderWidth: 3,
      pointRadius: 3,
      fill: false,
      yAxisID: lasLine.yAxisId || "left",
      tension: 0.35,
      borderCapStyle: "round" as const,
      cubicInterpolationMode: "monotone" as const,
    },
    ...thresholdDatasets,
  ];
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
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => {
            if (ctx.dataset.label === lasLine.label) {
              return ` ${lasLine.label}: ${ctx.parsed.y} dB`;
            }
            return ` ${ctx.dataset.label}: ${ctx.parsed.y} dB`;
          },
        },
      },
      title: { display: false },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x' as const,
          modifierKey: 'ctrl' as const,
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x' as const,
        },
        limits: {
          x: { minRange: 5 },
        },
      },
    },
    scales: {
      [lasLine.yAxisId || "left"]: {
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
  // Nur Linien mit mindestens einem Wert ≠ null anzeigen
  const linesWithData = lines.filter(line =>
    Array.isArray(data) && data.some(d => typeof d[line.key] === 'number')
  );
  const linesWithoutData = lines.filter(line =>
    !Array.isArray(data) || !data.some(d => typeof d[line.key] === 'number')
  );
  return (
    <div style={{ height }} className="w-full bg-card rounded-xl shadow-lg p-4 md:p-8 relative flex flex-col">
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