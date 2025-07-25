import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const logsDir = path.join(process.cwd(), 'logs')
    let clearedFiles = 0
    
    if (fs.existsSync(logsDir)) {
      const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'))
      
      for (const logFile of logFiles) {
        const logFilePath = path.join(logsDir, logFile)
        fs.writeFileSync(logFilePath, '')
        clearedFiles++
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Cleared ${clearedFiles} log files`,
      clearedFiles
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
} 