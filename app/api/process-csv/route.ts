import { NextResponse } from "next/server"
import csvWatcher from "@/lib/csv-watcher"

export async function POST() {
  try {
    await csvWatcher.processAllFiles()
    
    return NextResponse.json({ 
      success: true, 
      message: `CSV processing completed successfully`
    })
  } catch (e) {
    return NextResponse.json({ 
      success: false, 
      error: (e as Error).message,
      notify: true
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    await csvWatcher.processAllFiles()
    
    return NextResponse.json({ 
      success: true, 
      message: `CSV processing completed successfully`
    })
  } catch (e) {
    return NextResponse.json({ 
      success: false, 
      error: (e as Error).message 
    }, { status: 500 })
  }
} 