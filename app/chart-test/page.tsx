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
  const [data, setData] = useState(generateDemoData())
  const [loading, setLoading] = useState(false)
  // Simulierter Loading-Spinner
  function handleGenerateData() {
    setLoading(true)
    setTimeout(() => {
      setData(generateDemoData())
      setLoading(false)
    }, 600)
  }
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-5xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <span className="text-lg font-bold">Ort</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 mb-6">
              {/* Chart */}
              <GenericChart
                data={data}
                lines={lines}
                axes={axes}
                legend={true}
                height={400}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 