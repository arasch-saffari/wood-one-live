import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export async function GET() {
  try {
    const file = path.join(process.cwd(), 'backups', 'last-health-problem.json')
    if (!fs.existsSync(file)) {
      return NextResponse.json({ notify: false })
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
    if (data.notify) {
      return NextResponse.json({ notify: true, message: `Systemintegritätsproblem: ${data.nulls || 0} fehlerhafte Messungen, ${data.missingCreatedAt || 0} Wetter ohne Timestamp.` })
    }
    return NextResponse.json({ notify: false })
  } catch (e: unknown) {
    console.error('Monitoring status error:', e)
    return NextResponse.json({ notify: false })
  }
} 