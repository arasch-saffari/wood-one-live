// Design Tokens & Utility-Klassen für Zugvoegel-Style
//
// Farbverläufe (Gradients):
//   - from-white/90 via-blue-50/60 to-blue-100/40
//   - dark:from-gray-900/80 dark:via-gray-800/80 dark:to-blue-900/30
// Primärfarben: Blau, Cyan, Violett, Pink (siehe Zugvoegel-Header)
// Badge-Farben: bg-yellow-400/20, bg-red-400/20, text-yellow-700, text-red-700
// Card-Backgrounds: bg-white/90, dark:bg-gray-900/80, bg-gradient-to-br ...
// Border-Radius: rounded-2xl, rounded-xl
// Standard-Padding/Spacing: p-4, p-6, gap-4, gap-6, md:p-8
// Icon-Größen/Farben: Lucide, w-6 h-6, text-blue-500, text-cyan-700, etc.
// Table: Header sticky, Zebra-Striping, kompakte Pagination, text-xs/md:text-sm
// Filterleiste: sticky, backdrop-blur, bg-gradient, Dropdowns mit Placeholder
// KPI-Card: Icon-Box, Badge, Titel, alles zentriert, Padding
// Diese Tokens/Patterns dienen als Referenz für alle weiteren UI-Refactorings.

// Zentrale Design-Tokens für das Dashboard

export const colors = {
  primary: "#7c3aed", // violet-600
  secondary: "#f472b6", // pink-400
  accent: "#06b6d4", // cyan-500
  background: "#f8fafc", // slate-50
  card: "#fff",
  border: "#e5e7eb", // gray-200
  muted: "#f1f5f9", // slate-100
  warning: "#facc15", // yellow-400
  error: "#ef4444", // red-500
  success: "#22c55e", // emerald-500
  info: "#38bdf8", // sky-400
}

export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "2rem",
  xl: "4rem",
}

export const fontSizes = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  '2xl': "1.5rem",
  '3xl': "1.875rem",
  '4xl': "2.25rem",
}

export const borderRadius = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "1rem",
  xl: "2rem",
}

export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} 