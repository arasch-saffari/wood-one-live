import { NextResponse } from "next/server"
import { getOrFetchWeather } from "../route"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const station = searchParams.get("station") || "global"
    const timesParam = searchParams.get("times")
    if (!timesParam) {
      return NextResponse.json({ error: "Missing times parameter" }, { status: 400 })
    }
    const times = timesParam.split(",").map(t => t.trim()).filter(Boolean)
    const result: Record<string, { windSpeed?: number; windDir?: string; relHumidity?: number } | null> = {}
    for (const time of times) {
      result[time] = await getOrFetchWeather(station, time)
    }
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
} 