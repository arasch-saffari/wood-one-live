export function useThresholdStatus(value: number, warning?: number, alarm?: number) {
  const w = warning ?? 55
  const a = alarm ?? 60
  if (value >= a) return { label: "Alarm", color: "bg-red-100 text-red-600" }
  if (value >= w) return { label: "Warnung", color: "bg-yellow-100 text-yellow-700" }
  return { label: "Normal", color: "bg-emerald-100 text-emerald-700" }
} 