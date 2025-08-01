import { NextResponse } from "next/server"
import fs from 'fs'
import path from 'path'
import { initializeApplication } from '@/lib/app-init'

let initialized = false

export async function GET() {
  // Initialize application on first API call
  if (!initialized) {
    try {
      initializeApplication()
      initialized = true
    } catch (error) {
      console.error('Application initialization failed:', error)
      // Continue anyway, don't fail the status check
    }
  }

  try {
    const stations = ['ort', 'techno', 'heuballern', 'band']
    const status = {
      watcherActive: true,
      watchedDirectories: [] as Array<{
        station: string;
        path: string;
        files: Array<{
          name: string;
          size: number;
          modified: string;
          path: string;
        }>;
        fileCount: number;
      }>,
      totalFiles: 0,
      lastCheck: new Date().toISOString(),
      watcherHeartbeat: null as string | null,
    }
    // Heartbeat lesen
    try {
      const heartbeatPath = path.join(process.cwd(), 'backups', 'watcher-heartbeat.txt')
      if (fs.existsSync(heartbeatPath)) {
        status.watcherHeartbeat = fs.readFileSync(heartbeatPath, 'utf-8')
      }
    } catch {
      // ignore heartbeat read errors
    }
    
    for (const station of stations) {
      const csvDir = path.join(process.cwd(), "public", "csv", station)
      
      if (fs.existsSync(csvDir)) {
        const files = fs.readdirSync(csvDir)
          .filter(file => file.endsWith('.csv') && !file.startsWith('_gsdata_'))
          .map(file => {
            const filePath = path.join(csvDir, file)
            const stats = fs.statSync(filePath)
            return {
              name: file,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              path: filePath
            }
          })
          .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
        
        status.watchedDirectories.push({
          station,
          path: csvDir,
          files: files,
          fileCount: files.length
        })
        
        status.totalFiles += files.length
      }
    }
    
    const processingLockPath = path.join(process.cwd(), 'backups', 'csv-processing.lock')
    const processing = fs.existsSync(processingLockPath)

    return NextResponse.json({
      ...status,
      processing,
    })
  } catch (e) {
    return NextResponse.json({ 
      success: false, 
      error: (e as Error).message 
    }, { status: 500 })
  }
} 