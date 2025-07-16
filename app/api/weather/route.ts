import { NextResponse } from "next/server"
import { fetchWeather } from "@/lib/weather"
import { getWeatherForBlock, insertWeather, isWeatherDataOld } from "@/lib/db"
import { roundTo5MinBlock } from "@/lib/utils"

// Hilfsfunktion für Einzel- oder Batchabfrage
export async function getOrFetchWeather(station: string, time: string) {
  const blockTime = roundTo5MinBlock(time)
  let weather = getWeatherForBlock(station, blockTime)
  
  // Check if weather data is older than 10 minutes or doesn't exist
  if (!weather || isWeatherDataOld(station, blockTime, 10)) {
    try {
      const live = await fetchWeather()
      insertWeather(
        station,
        blockTime,
        live.windSpeed ?? 0,
        live.windDir ?? "N/A",
        live.relHumidity ?? 0
      )
      weather = getWeatherForBlock(station, blockTime)
    } catch (e) {
      console.error('Failed to fetch weather:', e)
      // If fetch fails, return existing data if available
      if (!weather) {
        return {
          windSpeed: 0,
          windDir: "N/A",
          relHumidity: 0
        }
      }
    }
  }
  return weather
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const station = searchParams.get("station") || "global"
    const time = searchParams.get("time")
    if (!time) {
      return NextResponse.json({ error: "Missing time parameter" }, { status: 400 })
    }
    const weather = await getOrFetchWeather(station, time)
    return NextResponse.json(weather)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
} 