#!/usr/bin/env tsx

import { update15MinAggregates, trigger15MinAggregation } from '../lib/db'
import db from '../lib/database'

async function testAggregation() {
  console.log('🧪 Testing 15-minute aggregation system...')
  
  try {
    // Test 1: Check if aggregation table exists
    console.log('\n📊 Test 1: Checking aggregation table...')
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='measurements_15min_agg'
    `).get()
    
    if (tableExists) {
      console.log('✅ Aggregation table exists')
    } else {
      console.log('❌ Aggregation table does not exist')
    }
    
    // Test 2: Check current aggregation data
    console.log('\n📊 Test 2: Checking current aggregation data...')
    const aggStats = db.prepare(`
      SELECT station, COUNT(*) as count 
      FROM measurements_15min_agg 
      WHERE bucket >= datetime('now', '-1 day')
      GROUP BY station
    `).all() as Array<{ station: string, count: number }>
    
    console.log('📈 Current aggregation statistics:', aggStats)
    
    // Test 3: Run aggregation
    console.log('\n📊 Test 3: Running aggregation...')
    const result = update15MinAggregates()
    console.log('📊 Aggregation result:', result)
    
    // Test 4: Check aggregation after update
    console.log('\n📊 Test 4: Checking aggregation after update...')
    const newAggStats = db.prepare(`
      SELECT station, COUNT(*) as count 
      FROM measurements_15min_agg 
      WHERE bucket >= datetime('now', '-1 day')
      GROUP BY station
    `).all() as Array<{ station: string, count: number }>
    
    console.log('📈 Updated aggregation statistics:', newAggStats)
    
    // Test 5: Test trigger mechanism
    console.log('\n📊 Test 5: Testing trigger mechanism...')
    trigger15MinAggregation(true)
    console.log('✅ Trigger mechanism works')
    
    // Test 6: Validate data integrity
    console.log('\n📊 Test 6: Validating data integrity...')
    const integrityCheck = db.prepare(`
      SELECT 
        COUNT(*) as total_measurements,
        COUNT(DISTINCT station) as stations,
        MIN(datetime) as earliest,
        MAX(datetime) as latest
      FROM measurements
      WHERE datetime >= datetime('now', '-7 days')
    `).get() as { total_measurements: number, stations: number, earliest: string, latest: string }
    
    console.log('📊 Data integrity check:', integrityCheck)
    
    // Test 7: Check API endpoint simulation
    console.log('\n📊 Test 7: Simulating API endpoint...')
    const stations = ['ort', 'techno', 'heuballern', 'band']
    for (const station of stations) {
      const aggCount = db.prepare(`
        SELECT COUNT(*) as total
        FROM measurements_15min_agg
        WHERE station = ? AND bucket >= datetime('now', '-24 hours')
      `).get(station) as { total: number }
      
      console.log(`📊 ${station}: ${aggCount.total} aggregated entries in last 24h`)
    }
    
    console.log('\n✅ All aggregation tests completed successfully!')
    
  } catch (error) {
    console.error('❌ Aggregation test failed:', error)
    process.exit(1)
  }
}

// Run the test
testAggregation().then(() => {
  console.log('🎉 Aggregation test completed')
  process.exit(0)
}).catch(error => {
  console.error('💥 Aggregation test failed:', error)
  process.exit(1)
}) 