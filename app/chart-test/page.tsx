"use client";
import { useState } from 'react';
import { GenericChart } from '@/components/GenericChart';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, RefreshCw, BarChart3 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';

const granularities = ['1h', '15min', '10min', '5min', '1min']
const pointOptions = [50, 100, 200, 500, 0]

function generateDemoData(len = 30) {
  return Array.from({ length: len }).map((_, i) => ({
    time: `${String(i).padStart(2, '0')}:00`,
    ort: 50 + Math.sin(i / 5) * 5 + Math.random() * 2,
    techno: 52 + Math.cos(i / 6) * 4 + Math.random() * 2,
    band: 48 + Math.sin(i / 7) * 6 + Math.random() * 2,
    windSpeed: 10 + Math.sin(i / 8) * 3 + Math.random() * 1.5,
  }))
}

const lines = [
  { key: 'ort', label: 'Ort', color: '#10b981', yAxisId: 'left' },
  { key: 'techno', label: 'Techno Floor', color: '#a21caf', yAxisId: 'left' },
  { key: 'band', label: 'Band Bühne', color: '#f59e42', yAxisId: 'left' },
  { key: 'windSpeed', label: 'Windgeschwindigkeit', color: '#06b6d4', yAxisId: 'wind', strokeDasharray: '5 5' },
]
const axes = [
  { id: 'left', orientation: 'left' as const, domain: [30, 85] as [number, number], label: 'dB' },
  { id: 'wind', orientation: 'right' as const, domain: [0, 25] as [number, number], label: 'km/h' },
]

const stationOptions = [
  { key: 'ort', label: 'Ort' },
  { key: 'techno', label: 'Techno Floor' },
  { key: 'band', label: 'Band Bühne' },
];

export default function ChartTestPage() {
  const { config } = useConfig();
  const intervals = config?.allowedIntervals || ['12h', '24h', '48h', '5d', '7d'];
  const [interval, setInterval] = useState(intervals[0] || '24h');
  const [granularity, setGranularity] = useState('15min')
  const [maxPoints, setMaxPoints] = useState(0)
  const [data, setData] = useState(generateDemoData())
  const [loading, setLoading] = useState(false)
  const [station, setStation] = useState(stationOptions[0].key);

  // Simulierter Loading-Spinner
  function handleGenerateData() {
    setLoading(true)
    setTimeout(() => {
      setData(generateDemoData())
      setLoading(false)
    }, 600)
  }

  function handleReset() {
    setInterval('24h')
    setGranularity('15min')
    setMaxPoints(0)
    setData(generateDemoData())
  }

  // Dummy-Export
  function handleExport(type: 'csv' | 'img') {
    if (type === 'csv') {
      const headers = ['station', 'date', 'time', 'maxSPLAFast'];
      const csvContent = [headers.join(','), ...data.map((row) => headers.map((header) => row[header]).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (type === 'img') {
      // ... bestehende Logik für Bildexport ...
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-5xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <span className="text-lg font-bold">{stationOptions[0].label}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                {/* Zeitraum-Auswahl */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold mr-2" title="Datenzeitraum">Zeitraum:</span>
                  <Select value={interval} onValueChange={setInterval}>
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
                  <Select value={granularity} onValueChange={setGranularity}>
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
                  <Select value={String(maxPoints)} onValueChange={v => setMaxPoints(Number(v))}>
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
                data={data}
                lines={lines}
                axes={axes}
                legend={true}
                height={400}
                maxPointsDefault={maxPoints}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 