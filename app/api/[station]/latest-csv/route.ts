import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET(req: Request, context: { params: Promise<{ station: string }> }) {
  const params = await context.params
  const { station } = params
  const csvDir = path.join(process.cwd(), "public", "csv", station)
  let latestFile = null
  let latestMtime = 0

  // NEU: Existenzprüfung für das Verzeichnis
  if (!fs.existsSync(csvDir)) {
    return NextResponse.json({ error: `CSV-Ordner für Station '${station}' nicht vorhanden.` }, { status: 404 })
  }

  try {
    const files = fs.readdirSync(csvDir)
    for (const file of files) {
      if (file.startsWith("_gsdata_")) continue
      if (!file.endsWith(".csv")) continue
      const filePath = path.join(csvDir, file)
      const stat = fs.statSync(filePath)
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs
        latestFile = file
      }
    }
    if (!latestFile) {
      return NextResponse.json({ error: "No CSV file found" }, { status: 404 })
    }
    return NextResponse.json({ file: latestFile })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
} 