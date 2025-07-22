import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  // Dummy-Daten für geplante Aufgaben
  const crons = [
    {
      name: 'Wetter-Update',
      schedule: 'alle 10 Minuten',
      lastRun: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      status: 'OK',
    },
  ]
  return NextResponse.json({ crons })
} 