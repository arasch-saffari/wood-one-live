#!/usr/bin/env tsx

// Test script to verify station data loading
console.log('🧪 Testing station data loading for all stations...\n');

async function testStationData() {
  const stations = ['ort', 'heuballern', 'techno', 'band'];
  
  for (const station of stations) {
    console.log(`📊 Testing ${station} station:`);
    
    try {
      // Test chart data
      const chartResponse = await fetch(`http://localhost:3000/api/station-data?station=${station}&aggregate=15min&interval=7d`);
      const chartData = await chartResponse.json();
      
      console.log(`  Chart data: ${chartData.data?.length || 0} points`);
      
      if (chartData.data && chartData.data.length > 0) {
        const latest = chartData.data[0];
        console.log(`  Latest data: ${latest.las} dB at ${latest.time}`);
      }
      
      // Test KPI data
      const kpiResponse = await fetch(`http://localhost:3000/api/station-data?station=${station}&interval=7d&aggregate=kpi`);
      const kpiData = await kpiResponse.json();
      
      console.log(`  KPI data: avg=${kpiData.avg}, max=${kpiData.max}, trend=${kpiData.trend}`);
      
      // Test table data
      const tableResponse = await fetch(`http://localhost:3000/api/table-data?station=${station}&pageSize=5`);
      const tableData = await tableResponse.json();
      
      console.log(`  Table data: ${tableData.data?.data?.length || 0} rows`);
      
      if (tableData.data?.data && tableData.data.data.length > 0) {
        const latest = tableData.data.data[0];
        console.log(`  Latest table: ${latest.las} dB at ${latest.time}`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error testing ${station}:`, error);
    }
    
    console.log('');
  }
  
  console.log('✅ Station data test completed!');
  console.log('\n📋 Summary:');
  console.log('- All stations should have chart data');
  console.log('- All stations should have table data');
  console.log('- KPI data may be calculated from chart data');
  console.log('- Data should be from 7-day interval');
}

testStationData(); 