import { MapPin, Volume2, Music } from "lucide-react"
import { STATION_COLORS } from "@/lib/colors"
import { ComponentType, SVGProps } from "react"

type StationKey = "ort" | "techno" | "band" | "heuballern"

type IconType = ComponentType<SVGProps<SVGSVGElement>>

export const STATION_META: Record<StationKey, {
  id: StationKey
  name: string
  icon: IconType
  color: string
  gradient: string
  kpiColor: string
  chartColor: string
}> = {
  ort: {
    id: "ort",
    name: "Ort",
    icon: MapPin,
    color: "emerald",
    gradient: "from-emerald-400 to-emerald-600",
    kpiColor: "emerald-500",
    chartColor: STATION_COLORS.ort.chartColor,
  },
  techno: {
    id: "techno",
    name: "Techno Floor",
    icon: Volume2,
    color: "pink",
    gradient: "from-pink-400 to-pink-600",
    kpiColor: "pink-500",
    chartColor: STATION_COLORS.techno.chartColor,
  },
  band: {
    id: "band",
    name: "Band Bühne",
    icon: Music,
    color: "purple",
    gradient: "from-purple-400 to-purple-600",
    kpiColor: "purple-500",
    chartColor: STATION_COLORS.band.chartColor,
  },
  heuballern: {
    id: "heuballern",
    name: "Heuballern",
    icon: MapPin,
    color: "cyan",
    gradient: "from-cyan-400 to-cyan-600",
    kpiColor: "cyan-500",
    chartColor: STATION_COLORS.heuballern.chartColor,
  },
}

export function useStationMeta(station: StationKey) {
  return STATION_META[station]
} 