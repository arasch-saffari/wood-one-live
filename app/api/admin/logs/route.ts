import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const logPath = path.join(process.cwd(), 'logs', 'system.log')
    if (!fs.existsSync(logPath)) {
      return NextResponse.json({ lines: [] })
    }
    const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean)
    return NextResponse.json({ logs: lines })
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json({ error: error.message || 'Fehler beim Laden der Logs.' }, { status: 500 })
  }
} 