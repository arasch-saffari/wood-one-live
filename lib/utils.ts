import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function roundTo5MinBlock(time: string): string {
  // time: "HH:MM"
  const [h, m] = time.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return time
  const rounded = Math.floor(m / 5) * 5
  return `${h.toString().padStart(2, "0")}:${rounded.toString().padStart(2, "0")}`
}

export function getThresholdsForStationAndTime(config: any, station: string, time: string) {
  if (!config || !config.thresholdsByStationAndTime || !config.thresholdsByStationAndTime[station]) {
    // Fallback auf globale Werte
    return {
      warning: config?.warningThreshold ?? 55,
      alarm: config?.alarmThreshold ?? 60,
      las: config?.lasThreshold ?? 50,
      laf: config?.lafThreshold ?? 52,
    }
  }
  // Zeit als Minuten seit Mitternacht
  const [h, m] = time.split(":").map(Number)
  const minutes = h * 60 + m
  // Finde passenden Zeitblock
  for (const block of config.thresholdsByStationAndTime[station]) {
    const [fromH, fromM] = block.from.split(":").map(Number)
    const [toH, toM] = block.to.split(":").map(Number)
    const fromMin = fromH * 60 + fromM
    const toMin = toH * 60 + toM
    if (fromMin < toMin) {
      // Tagblock (z.B. 08:00-20:00)
      if (minutes >= fromMin && minutes < toMin) return block
    } else {
      // Nachtblock (z.B. 20:00-08:00, über Mitternacht)
      if (minutes >= fromMin || minutes < toMin) return block
    }
  }
  // Fallback auf ersten Block
  return config.thresholdsByStationAndTime[station][0]
}

// --- Rate Limiting ---
const rateLimitMap = new Map<string, { count: number; expires: number }>()

export function checkRateLimit(ip: string, route: string, limit: number = 30, windowMs: number = 60_000): boolean {
  const key = `${ip}:${route}`
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || entry.expires < now) {
    rateLimitMap.set(key, { count: 1, expires: now + windowMs })
    return true
  }
  if (entry.count >= limit) {
    return false
  }
  entry.count++
  rateLimitMap.set(key, entry)
  return true
}
