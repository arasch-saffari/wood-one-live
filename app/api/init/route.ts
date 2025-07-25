import { NextResponse } from 'next/server'
import { initializeApplication } from '@/lib/app-init'

let initialized = false

export async function GET() {
  if (!initialized) {
    try {
      initializeApplication()
      initialized = true
      return NextResponse.json({
        success: true,
        message: 'Application initialized successfully'
      })
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, { status: 500 })
    }
  }
  
  return NextResponse.json({
    success: true,
    message: 'Application already initialized'
  })
} 