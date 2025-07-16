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
