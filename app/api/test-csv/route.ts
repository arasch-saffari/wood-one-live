import { NextResponse } from "next/server"
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const stations = ['ort', 'techno', 'heuballern', 'band']
    const results = []
    
    for (const station of stations) {
      const csvDir = path.join(process.cwd(), "public", "csv", station)
      const exists = fs.existsSync(csvDir)
      const files = exists ? fs.readdirSync(csvDir).filter(file => file.endsWith('.csv')) : []
      
      results.push({
        station,
        csvDir,
        exists,
        fileCount: files.length,
        files: files.slice(0, 5) // Nur erste 5 Dateien
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      results,
      cwd: process.cwd()
    })
  } catch (e) {
    return NextResponse.json({ 
      success: false, 
      error: (e as Error).message 
    }, { status: 500 })
  }
} 