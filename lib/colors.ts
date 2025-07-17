// Zentrale Farbkonfiguration für konsistente Darstellung
// Diese Farben werden sowohl im Menü als auch in den Charts verwendet

export const STATION_COLORS = {
  all: {
    primary: "#64748b", // slate-500
    secondary: "#94a3b8", // slate-400
    menuColor: "text-slate-500",
    chartColor: "#64748b"
  },
  ort: {
    primary: "#10b981", // emerald-500
    secondary: "#34d399", // emerald-400
    menuColor: "text-emerald-500",
    chartColor: "#10b981"
  },
  heuballern: {
    primary: "#3b82f6", // blue-500
    secondary: "#60a5fa", // blue-400
    menuColor: "text-blue-500",
    chartColor: "#3b82f6"
  },
  techno: {
    primary: "#d946ef", // fuchsia-500
    secondary: "#e879f9", // fuchsia-400
    menuColor: "text-fuchsia-500",
    chartColor: "#d946ef"
  },
  band: {
    primary: "#f97316", // orange-500
    secondary: "#fb923c", // orange-400
    menuColor: "text-orange-500",
    chartColor: "#f97316"
  },
  export: {
    primary: "#64748b", // slate-500
    secondary: "#94a3b8", // slate-400
    menuColor: "text-slate-500",
    chartColor: "#64748b"
  }
} as const

// Chart-spezifische Farben für verschiedene Datenlinien
export const CHART_COLORS = {
  // Primäre Datenlinie (Lärmpegel)
  primary: "#8b5cf6", // violet-500 - passt zum Menü-Design
  
  // Sekundäre Datenlinien
  wind: "#06b6d4", // cyan-500
  humidity: "#10b981", // emerald-500
  temperature: "#f59e0b", // amber-500
  
  // Grenzwerte und Referenzlinien
  warning: "#facc15", // yellow-400
  danger: "#f87171", // red-400
  alarm: "#f87171", // red-400 (alias for danger)
  reference: "#94a3b8", // slate-400
  
  // Gradient-Farben für Bereiche
  gradients: {
    primary: {
      from: "#8b5cf6", // violet-500
      to: "#a78bfa"    // violet-400
    },
    secondary: {
      from: "#06b6d4", // cyan-500
      to: "#67e8f9"    // cyan-300
    }
  }
} as const

// Hilfsfunktion um Station-Farbe zu erhalten
export function getStationColor(station: keyof typeof STATION_COLORS, type: 'primary' | 'secondary' | 'menuColor' | 'chartColor' = 'primary') {
  return STATION_COLORS[station]?.[type] || STATION_COLORS.all[type]
}

// Hilfsfunktion um Chart-Farbe zu erhalten
export function getChartColor(type: keyof typeof CHART_COLORS) {
  return CHART_COLORS[type]
}
