import { NextResponse } from 'next/server'

export async function POST() {
  // TODO: Hier könnte ein echter Trigger für den TXT-Watcher stehen (z.B. per Child Process, Message, etc.)
  // Aktuell nur Platzhalter
  return NextResponse.json({ success: true, message: 'TXT-Watcher wurde (simuliert) getriggert.' })
} 