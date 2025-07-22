import { GenericChart } from "@/components/GenericChart";

interface StationChartProps {
  data: { date: string; time: string; maxSPLAFast: number }[];
  thresholds: { warning: number; alarm: number };
  stationColors: { primary: string };
  chartColors: { warning: string; alarm: string };
  stationName: string;
  maxPointsDefault?: number;
}

export function StationChart({
  data,
  thresholds,
  stationColors,
  chartColors,
  stationName,
  maxPointsDefault = 0,
}: StationChartProps) {
  const lines = [
    { key: "maxSPLAFast", label: "Max SPL A Fast", color: stationColors.primary, yAxisId: "noise" },
  ];
  const axes = [
    { id: "noise", orientation: "left" as const, domain: [30, 120] as [number, number], label: "Max SPL A Fast (dB)", ticks: [30, 50, 70, 90, 110] },
  ];
  const chartThresholds = [
    { value: thresholds.warning, label: "Warnung", color: chartColors.warning, yAxisId: "noise" },
    { value: thresholds.alarm, label: "Alarm", color: chartColors.alarm, yAxisId: "noise" },
  ];
  return (
    <GenericChart
      data={data}
      lines={lines}
      axes={axes}
      thresholds={chartThresholds}
      legend={true}
      maxPointsDefault={maxPointsDefault}
      height={350}
      tooltipFormatter={(value, name) => {
        if (name === "maxSPLAFast") return [`${value} dB`, "Max SPL A Fast"];
        if (Number(value) === thresholds.warning) return [`${value} dB`, "Warnung (Grenzwert)"];
        if (Number(value) === thresholds.alarm) return [`${value} dB`, "Alarm (Grenzwert)"];
        if (!name) return [String(value), "Wert"];
        return [String(value), name];
      }}
    />
  );
} 