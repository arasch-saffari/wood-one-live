'use client'
import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wind, AlertTriangle, Speaker, MapPin, Music, Volume2, Thermometer, Droplets, Calendar, Clock, Info } from "lucide-react"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useStationData } from "@/hooks/useStationData"
import { useConfig } from "@/hooks/useConfig"
import ChartPlayground from '@/components/ChartPlayground'
import { useWeatherData } from '@/hooks/useWeatherData'
import { STATION_META } from '@/lib/stationMeta'
import { cn } from '@/lib/utils'
import { AllStationsTable } from "@/components/AllStationsTable"
import { getAlarmThresholdForRow } from "@/components/AllStationsTable";

function windDirectionText(dir: number | string | null | undefined): string {
  if (dir === null || dir === undefined) return '–';
  const deg = typeof dir === 'string' ? parseFloat(dir) : dir;
  if (isNaN(deg)) {
    const map: Record<string, string> = {
      n: 'Norden', nne: 'Nordnordost', ne: 'Nordost', ene: 'Ostnordost',
      e: 'Osten', ese: 'Ostsüdost', se: 'Südost', sse: 'Südsüdost',
      s: 'Süden', ssw: 'Südsüdwest', sw: 'Südwest', wsw: 'Westsüdwest',
      w: 'Westen', wnw: 'Westnordwest', nw: 'Nordwest', nnw: 'Nordnordwest'
    };
    const key = typeof dir === 'string' ? dir.toLowerCase() : '';
    return map[key] || dir.toString();
  }
  const directions = [
    'Norden', 'Nordnordost', 'Nordost', 'Ostnordost',
    'Osten', 'Ostsüdost', 'Südost', 'Südsüdost',
    'Süden', 'Südsüdwest', 'Südwest', 'Westsüdwest',
    'Westen', 'Westnordwest', 'Nordwest', 'Nordnordwest', 'Norden'
  ];
  const idx = Math.round(((deg % 360) / 22.5));
  return directions[idx];
}

type TableRowType = {
  datetime?: string;
  time?: string;
  las?: number;
  ws?: number;
  wd?: number | string;
  rh?: number;
  station: string;
};
type StationKey = "ort" | "techno" | "band" | "heuballern";

type ThresholdBlock = {
  from: string;
  to: string;
  warning: number;
  alarm: number;
  las: number;
  laf: number;
};
type ChartColors = {
  primary: string;
  wind: string;
  humidity: string;
  temperature: string;
  warning: string;
  danger: string;
  alarm: string;
  reference: string;
  gradients: Record<string, { from: string; to: string }>;
};
type ConfigType = {
  warningThreshold: number;
  alarmThreshold: number;
  lasThreshold: number;
  lafThreshold: number;
  stations: StationKey[];
  enableNotifications: boolean;
  csvAutoProcess: boolean;
  backupRetentionDays: number;
  uiTheme: string;
  calculationMode: string;
  adminEmail: string;
  weatherApiKey: string;
  apiCacheDuration: number;
  pollingIntervalSeconds: number;
  chartLimit: number;
  pageSize: number;
  defaultInterval: string;
  defaultGranularity: string;
  allowedIntervals: string[];
  allowedGranularities: string[];
  chartColors: ChartColors;
  thresholdsByStationAndTime: Record<StationKey, ThresholdBlock[]>;
  chartVisibleLines: Record<string, string[]>;
};

export default function ZugvoegelDashboard() {
  // ALLE HOOKS GANZ OBEN!
  const { config } = useConfig() as { config: ConfigType | null };
  // Paging-States für jede Station
  const pageSize = 50;
  // Pagination state for AllStationsTable
  const [tablePage, setTablePage] = React.useState(1);
  const tablePageSize = 25;
  // Daten-Hooks
  const ortDataObj = useStationData("ort", "24h", 60000, 1, pageSize, "15min");
  const technoDataObj = useStationData("techno", "24h", 60000, 1, pageSize, "15min");
  const bandDataObj = useStationData("band", "24h", 60000, 1, pageSize, "15min");
  const ortData = ortDataObj.data ?? [];
  const technoData = technoDataObj.data ?? [];
  const bandData = bandDataObj.data ?? [];
  const { weather: latestWeather } = useWeatherData("global", "now", 60000)
  const [weatherLastUpdate, setWeatherLastUpdate] = React.useState<{ time: string|null } | null>(null)
  React.useEffect(() => {
    fetch('/api/weather/last-update')
      .then(res => res.json())
      .then(data => setWeatherLastUpdate(data))
      .catch(() => setWeatherLastUpdate(null))
  }, [])
  const chartTimes = Array.from(new Set([
    ...ortData.map(d => d.time),
    ...bandData.map(d => d.time),
    ...technoData.map(d => d.time),
  ])).sort();
  const chartData = chartTimes.map(time => {
    const ort = ortData.find((d) => d.time === time)
    const techno = technoData.find((d) => d.time === time)
    const band = bandData.find((d) => d.time === time)
    const windVals = [ort, techno, band].map(d => d?.ws).filter((v): v is number => typeof v === 'number')
    const windSpeed = windVals.length > 0 ? (windVals.reduce((a, b) => a + b, 0) / windVals.length) : undefined
    return {
      time,
      ort: ort?.las ?? null,
      techno: techno?.las ?? null,
      band: band?.las ?? null,
      windSpeed: windSpeed ?? null,
    }
  })

  // Helper: get latest las value by datetime desc
  function getLatestLevel(data: TableRowType[]): number | null {
    if (!data || data.length === 0) return null;
    const sorted = [...data].sort((a, b) => {
      const da = a.datetime ? new Date(a.datetime.replace(' ', 'T')).getTime() : 0;
      const db = b.datetime ? new Date(b.datetime.replace(' ', 'T')).getTime() : 0;
      return db - da;
    });
    return sorted[0]?.las ?? null;
  }
  // Map all data to TableRowType (with .station) for correct typing
  const mappedOrtData: TableRowType[] = ortData.map(row => ({ ...row, station: "Ort" }));
  const mappedTechnoData: TableRowType[] = technoData.map(row => ({ ...row, station: "Techno Floor" }));
  const mappedBandData: TableRowType[] = bandData.map(row => ({ ...row, station: "Band Bühne" }));
  const currentLevels = {
    ort: getLatestLevel(mappedOrtData),
    techno: getLatestLevel(mappedTechnoData),
    band: getLatestLevel(mappedBandData),
  }

  const WIND_COLOR = config && config.chartColors && config.chartColors.wind ? config.chartColors.wind : "#06b6d4";

  // Export-Funktionen entfernt (Export-Button entfällt)

  // Icon-Mapping für Stationen
  const STATION_ICONS: Record<string, React.ReactNode> = {
    "Ort": <MapPin className="w-6 h-6 text-emerald-500" />, 
    "Techno Floor": <Volume2 className="w-6 h-6 text-pink-500" />, 
    "Band Bühne": <Music className="w-6 h-6 text-purple-500" />
  }

  const [showOnlyAlarms, setShowOnlyAlarms] = React.useState(false);

  const allAlarmRows = [
    ...mappedOrtData.filter(row => {
      if (row.las === undefined || !config) return false;
      const alarmThreshold = getAlarmThresholdForRow(row, config);
      return alarmThreshold !== undefined && row.las >= alarmThreshold;
    }),
    ...mappedTechnoData.filter(row => {
      if (row.las === undefined || !config) return false;
      const alarmThreshold = getAlarmThresholdForRow(row, config);
      return alarmThreshold !== undefined && row.las >= alarmThreshold;
    }),
    ...mappedBandData.filter(row => {
      if (row.las === undefined || !config) return false;
      const alarmThreshold = getAlarmThresholdForRow(row, config);
      return alarmThreshold !== undefined && row.las >= alarmThreshold;
    }),
  ];

  if (!config) return <div className="flex items-center justify-center min-h-[300px] text-gray-400 text-sm">Lade Konfiguration ...</div>;

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4 md:p-8 pb-8 pt-4">
      <div className="max-w-6xl mx-auto w-full space-y-10">
        {/* Header */}
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-purple-700 to-pink-600 p-5 shadow-2xl border border-violet-300 dark:border-violet-900">
              <Speaker className="w-10 h-10 text-white drop-shadow-lg" />
            </div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-violet-700 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent tracking-tight drop-shadow-lg text-center">Wood One Audio</h1>
            <div className="text-lg text-gray-700 dark:text-gray-200 font-semibold mt-1 text-center">Live Monitoring Dashboard</div>
          </div>
        </div>
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-8 md:mb-10 gap-y-4">
          {Object.entries(currentLevels).map(([location, level]) => {
            const meta = STATION_META[location as keyof typeof STATION_META]
            return (
              <Card key={location} className="rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 hover:scale-[1.025] transition-transform">
                <CardHeader className="flex flex-row items-center gap-4 md:gap-6 p-3 md:p-8">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 shadow">
                        {STATION_ICONS[meta.name]}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{meta.name} (aktuell)</TooltipContent>
                  </Tooltip>
                  <div className="flex flex-col flex-1 items-center justify-center">
                    <span className="text-base md:text-lg font-bold text-gray-900 dark:text-white">{meta.name}</span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className={cn("rounded-lg px-3 md:px-4 py-1.5 md:py-2 text-base md:text-lg font-semibold cursor-pointer", meta.kpiColor)}>{typeof level === "number" && !isNaN(level) ? Math.round(level) : "keine daten"} dB</Badge>
                    </TooltipTrigger>
                    <TooltipContent>Lautstärke (dB)</TooltipContent>
                  </Tooltip>
                </CardHeader>
              </Card>
            )})}
        </div>
        {/* Wetter Card */}
        <Card className="mb-10 rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800">
          <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
            <div className="flex items-center gap-2">
              <Wind className="w-6 h-6 text-cyan-500" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">Wetter</span>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="w-4 h-4 mr-1" />
              {weatherLastUpdate?.time ?? '-'}
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-6">
            {latestWeather ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="flex items-center justify-center gap-2 mb-2"><Wind className="w-5 h-5 text-cyan-500" /><span className="text-xs">Wind</span></div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{latestWeather.windSpeed ?? '-'}<span className="text-base font-normal"> km/h</span></div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 mb-2"><Droplets className="w-5 h-5 text-blue-400" /><span className="text-xs">Luftfeuchte</span></div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{latestWeather.relHumidity ?? '-'}<span className="text-base font-normal">%</span></div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 mb-2"><Thermometer className="w-5 h-5 text-orange-400" /><span className="text-xs">Temperatur</span></div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{typeof latestWeather.temperature === 'number' ? Math.round(latestWeather.temperature) : '-'}<span className="text-base font-normal">°C</span></div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 mb-2"><Info className="w-5 h-5 text-purple-400" /><span className="text-xs">Richtung</span></div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{windDirectionText(latestWeather.windDir)}</div>
                </div>
              </div>
            ) : <div className="text-gray-400 text-center py-6">Keine Wetterdaten verfügbar</div>}
          </CardContent>
        </Card>
        {/* Chart */}
        <div className="mb-10 w-full">
          <ChartPlayground
            data={chartData}
            lines={[
              { key: 'ort', label: STATION_META.ort.name, color: STATION_META.ort.chartColor },
              { key: 'techno', label: STATION_META.techno.name, color: STATION_META.techno.chartColor },
              { key: 'band', label: STATION_META.band.name, color: STATION_META.band.chartColor },
              { key: 'windSpeed', label: 'Windgeschwindigkeit', color: WIND_COLOR, yAxisId: 'wind', strokeDasharray: '5 5' },
            ]}
            axes={[
              { id: 'left', orientation: 'left', domain: [30, 85], label: 'dB' },
              { id: 'wind', orientation: 'right', domain: [0, 25], label: 'km/h' },
            ]}
            title=""
            icon={null}
          />
        </div>
        {/* Tabellenansicht: Ersetze die drei Einzeltabellen durch eine AllStationsTable wie im All-Dashboard */}
        <div className="mb-10 w-full">
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={showOnlyAlarms} onChange={e => setShowOnlyAlarms(e.target.checked)} className="accent-red-600 w-4 h-4" />
              <span className="text-sm font-medium">Nur Alarme</span>
            </label>
          </div>
          <AllStationsTable
            ortData={mappedOrtData}
            heuballernData={[]}
            technoData={mappedTechnoData}
            bandData={mappedBandData}
            alarmRows={showOnlyAlarms ? allAlarmRows : undefined}
            showOnlyAlarms={showOnlyAlarms}
            config={{ ...config!, stations: ["ort", "techno", "band", "heuballern"] }}
            granularity={"15min"}
            filterStation={"__all__"}
            page={tablePage}
            setPage={setTablePage}
            pageSize={tablePageSize}
          />
        </div>
        {/* Grenzwert-Referenz */}
        <Card className="mb-10 rounded-2xl shadow-2xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800">
          <CardHeader className="flex flex-row items-center gap-4 p-6 pb-2">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">Grenzwert-Referenz</span>
          </CardHeader>
          <CardContent className="pt-0 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {config && Object.entries(config.thresholdsByStationAndTime).filter(([station]) => ["ort","techno","band"].includes(station as StationKey)).map(([station, blocks]) => {
                let showBlocks: Array<{from: string, to: string, warning: number, alarm: number}> = blocks as Array<{from: string, to: string, warning: number, alarm: number}>;
                if (station === "ort" && Array.isArray(blocks) && blocks.length > 2) {
                  showBlocks = showBlocks.slice(0, 2);
                }
                return (
                  <Card key={station} className="rounded-xl bg-white/90 dark:bg-gray-900/70 border-0 shadow-md p-4">
                    <CardHeader className="pb-2 flex flex-col items-center gap-2 text-center">
                      <CardTitle className="text-base font-semibold text-gray-700 dark:text-gray-300 w-full text-center">
                        {station.charAt(0).toUpperCase() + station.slice(1)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      {showBlocks.map((block, i: number) => (
                        <div
                          key={i}
                          className={
                            `flex flex-col gap-1 p-2 rounded-lg mb-2 last:mb-0 transition-all ` +
                            `hover:shadow-lg hover:ring-2 hover:ring-yellow-300/40 dark:hover:ring-yellow-500/30 `
                          }
                        >
                          <div className="flex items-center justify-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-1 text-center w-full">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span>{block.from} - {block.to}</span>
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <Badge className="bg-yellow-400/20 text-yellow-700 border-yellow-400/30 px-3 py-1 min-w-[170px] rounded-md flex items-center gap-1 text-base font-semibold transition-colors hover:bg-yellow-400/80 hover:text-yellow-900 hover:shadow-md justify-center">
                              <AlertTriangle className="w-4 h-4" /> Warnung: ≥ {block.warning} dB
                            </Badge>
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <Badge className="bg-red-400/20 text-red-700 border-red-400/30 px-3 py-1 min-w-[170px] rounded-md flex items-center gap-1 text-base font-semibold transition-colors hover:bg-red-400/80 hover:text-red-900 hover:shadow-md justify-center">
                              <AlertTriangle className="w-4 h-4" /> Alarm: ≥ {block.alarm} dB
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </TooltipProvider>
  )
} 