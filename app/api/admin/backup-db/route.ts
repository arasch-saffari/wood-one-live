import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), 'data.sqlite')
    if (!fs.existsSync(dbPath)) {
      return new Response('No database found', { status: 404 })
    }
    const fileBuffer = fs.readFileSync(dbPath)
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="data.sqlite"',
      },
    })
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Fehler beim Backup';
    return new Response(JSON.stringify({ error: errorMsg, notify: true }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
} 