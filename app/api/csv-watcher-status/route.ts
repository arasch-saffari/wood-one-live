import { NextResponse } from "next/server"
import fs from 'fs'
import path from 'path'

export async function GET() {
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
      lastCheck: new Date().toISOString()
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
    
    return NextResponse.json(status)
  } catch (e) {
    console.error('❌ Error getting CSV watcher status:', e)
    return NextResponse.json({ 
      success: false, 
      error: (e as Error).message 
    }, { status: 500 })
  }
} 