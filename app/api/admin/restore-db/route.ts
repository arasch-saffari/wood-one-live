import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file || !file.name.endsWith('.sqlite')) {
      return NextResponse.json({ success: false, message: 'Bitte eine gültige .sqlite-Datei hochladen.' }, { status: 400 })
    }
    const arrayBuffer = await file.arrayBuffer()
    const dbPath = path.join(process.cwd(), 'data.sqlite')
    fs.writeFileSync(dbPath, Buffer.from(arrayBuffer))
    return NextResponse.json({ success: true, message: 'Backup erfolgreich wiederhergestellt.' })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Fehler beim Restore.'
    return NextResponse.json({ success: false, message: errorMessage, notify: true }, { status: 500 })
  }
} 