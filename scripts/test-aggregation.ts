#!/usr/bin/env tsx
import { update15MinAggregates } from '../lib/db'
import db from '../lib/database'

async function testAggregation() {
  console.log('🧪 Testing 15-minute aggregation...')
  
  // Prüfe aktuelle Datenlage
  const measurementCount = db.prepare(`
    SELECT station, COUNT(*) as count 
    FROM measurements 
    WHERE datetime >= datetime('now', '-24 hours')
    GROUP BY station
  `).all() as Array<{ station: string, count: number }>
  
  console.log('📊 Current measurements in last 24h:', measurementCount)
  
  // Führe Aggregation durch
  console.log('🔄 Running aggregation...')
  const result = await update15MinAggregates()
  
  if (result.success) {
    console.log('✅ Aggregation completed successfully')
    console.log(`⏱️ Duration: ${result.duration}ms`)
    console.log('📈 Statistics:', result.stats)
    console.log(`📊 Total aggregates: ${result.totalAggregates}`)
    
    // Prüfe Qualität der Aggregation
    const qualityCheck = db.prepare(`
      SELECT 
        station,
        COUNT(*) as aggregate_count,
        MIN(bucket) as earliest,
        MAX(bucket) as latest,
        AVG(avgLas) as avg_las
      FROM measurements_15min_agg 
      WHERE bucket >= datetime('now', '-24 hours')
      GROUP BY station
    `).all() as Array<{ station: string, aggregate_count: number, earliest: string, latest: string, avg_las: number }>
    
    console.log('🔍 Quality check:', qualityCheck)
    
    // Prüfe ob genügend 15-Minuten-Intervalle vorhanden sind (96 pro Tag)
    for (const station of qualityCheck) {
      const expectedIntervals = 96 // 24h * 4 intervals per hour
      const coverage = (station.aggregate_count / expectedIntervals) * 100
      console.log(`${station.station}: ${station.aggregate_count}/${expectedIntervals} intervals (${coverage.toFixed(1)}% coverage)`)
      
      if (coverage < 50) {
        console.warn(`⚠️ Low coverage for ${station.station} - may need more frequent aggregation`)
      }
    }
    
  } else {
    console.error('❌ Aggregation failed:', result.error)
  }
  
  // Teste API-Endpunkt mit 15min Aggregation
  console.log('\n🧪 Testing API endpoint with 15min aggregation...')
  try {
    const response = await fetch('http://localhost:3000/api/station-data?station=ort&aggregate=15min&interval=24h')
    const data = await response.json()
    
    console.log('📡 API Response:', {
      dataLength: data.data?.length || 0,
      aggregationState: data.aggregation_state,
      aggregationCount: data.aggregation_count
    })
    
    if (data.data && data.data.length > 0) {
      console.log('📊 Sample data points:', data.data.slice(0, 3))
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error)
  }
  
  process.exit(0)
}

testAggregation().catch(console.error) 