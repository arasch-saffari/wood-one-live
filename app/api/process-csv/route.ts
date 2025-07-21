import { NextResponse } from "next/server"
import csvWatcher from "@/lib/csv-watcher"

export async function POST() {
  try {
    console.log('🔄 Manual CSV processing triggered...')
    await csvWatcher.processAllFiles()
    
    return NextResponse.json({ 
      success: true, 
      message: `CSV processing completed successfully`
    })
  } catch (e) {
    console.error('❌ CSV processing failed:', e)
    return NextResponse.json({ 
      success: false, 
      error: (e as Error).message,
      notify: true
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    console.log('🔄 Manual CSV processing triggered via GET...')
    await csvWatcher.processAllFiles()
    
    return NextResponse.json({ 
      success: true, 
      message: `CSV processing completed successfully`
    })
  } catch (e) {
    console.error('❌ CSV processing failed:', e)
    return NextResponse.json({ 
      success: false, 
      error: (e as Error).message 
    }, { status: 500 })
  }
} 