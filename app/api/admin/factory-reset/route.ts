import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { fetchWeather } from '@/lib/weather'

export async function POST() {
  try {
    // 1. Alle Daten aus der DB löschen
    db.exec('DELETE FROM measurements;')
    db.exec('DELETE FROM weather;')

    // 2. Wetterdaten neu abfragen (einmalig)
    await fetchWeather()

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json({ success: false, message: error.message || 'Fehler beim Factory-Reset.' }, { status: 500 })
  }
} 