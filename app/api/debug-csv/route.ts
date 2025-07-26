import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import db from '@/lib/database'

export async function GET() {
  try {
    const debugInfo: {
      environment: {
        NODE_ENV: string | undefined
        platform: string
        cwd: string
        databasePath: string
      }
      csvDirectories: Record<string, {
        exists: boolean
        path: string
        fileCount: number
        files: string[]
        error?: string
      }>
      databaseContents: {
        totalStations?: number
        stations?: Array<{ station: string; count: number }>
        totalRecords?: { count: number }
        error?: string
      }
      errors: string[]
    } = {
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        platform: process.platform,
        cwd: process.cwd(),
        databasePath: process.env.DATABASE_PATH || './data.sqlite'
      },
      csvDirectories: {},
      databaseContents: {},
      errors: []
    }

    // Überprüfe CSV-Verzeichnisse
    const stations = ['ort', 'techno', 'heuballern', 'band']
    for (const station of stations) {
      const csvDir = path.join(process.cwd(), 'public', 'csv', station)
      try {
        if (fs.existsSync(csvDir)) {
          const csvFiles = fs.readdirSync(csvDir).filter(file => file.endsWith('.csv'))
          debugInfo.csvDirectories[station] = {
            exists: true,
            path: csvDir,
            fileCount: csvFiles.length,
            files: csvFiles.slice(0, 5) // Erste 5 Dateien
          }
        } else {
          debugInfo.csvDirectories[station] = {
            exists: false,
            path: csvDir,
            fileCount: 0,
            files: []
          }
        }
      } catch (error) {
        debugInfo.csvDirectories[station] = {
          exists: false,
          path: csvDir,
          error: error instanceof Error ? error.message : String(error),
          fileCount: 0,
          files: []
        }
        debugInfo.errors.push(`Error checking ${station}: ${error}`)
      }
    }

    // Überprüfe Datenbank-Inhalte
    try {
      const stationCounts = db.prepare('SELECT station, COUNT(*) as count FROM measurements GROUP BY station').all() as Array<{ station: string; count: number }>
      debugInfo.databaseContents = {
        totalStations: stationCounts.length,
        stations: stationCounts,
        totalRecords: db.prepare('SELECT COUNT(*) as count FROM measurements').get() as { count: number }
      }
    } catch (dbError) {
      debugInfo.databaseContents = {
        error: dbError instanceof Error ? dbError.message : String(dbError)
      }
      debugInfo.errors.push(`Database error: ${dbError}`)
    }

    return NextResponse.json(debugInfo)
  } catch (error) {
    return NextResponse.json({
      error: 'Debug route failed',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
} 