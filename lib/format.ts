// Zentrale Formatierungsfunktionen für das Dashboard

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export function formatNumber(num: number, decimals = 1): string {
  return num.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatDb(db: number): string {
  return `${formatNumber(db, 1)} dB`
}

export function formatTemperature(temp: number): string {
  return `${formatNumber(temp, 1)} °C`
}

export function formatWind(ws: number): string {
  return `${formatNumber(ws, 1)} km/h`
}

export function formatHumidity(rh: number): string {
  return `${Math.round(rh)} %`
} 