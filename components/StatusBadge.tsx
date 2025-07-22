import { Badge } from "@/components/ui/badge"

interface StatusBadgeProps {
  status: "Normal" | "Warnung" | "Alarm"
  color: string
}

export function StatusBadge({ status, color }: StatusBadgeProps) {
  return (
    <Badge className={color}>{status}</Badge>
  )
} 