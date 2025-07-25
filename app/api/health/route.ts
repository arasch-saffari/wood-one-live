import { NextResponse } from 'next/server'
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
      // Continue anyway, don't fail the health check
    }
  }

  try {
    const startTime = Date.now()
    
    // Basic health check
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    }
    
    const responseTime = Date.now() - startTime
    
    return NextResponse.json({
      ...health,
      responseTime: `${responseTime}ms`
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}