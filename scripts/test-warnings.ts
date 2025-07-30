#!/usr/bin/env tsx
import { getAlarmThresholdForRow, getWarningThresholdForRow } from '../components/AllStationsTable'

// Mock config with thresholds
const mockConfig = {
  thresholdsByStationAndTime: {
    band: [
      {
        from: "10:00",
        to: "22:00",
        warning: 95,
        alarm: 98,
        las: 93,
        laf: 95
      },
      {
        from: "22:00",
        to: "10:00",
        warning: 92,
        alarm: 95,
        las: 90,
        laf: 92
      }
    ]
  }
} as any;

// Test data
const testRows = [
  {
    time: "2025-07-26 01:13:39",
    las: 88.2,
    station: "Band Bühne"
  },
  {
    time: "2025-07-26 01:12:08",
    las: 92.8,
    station: "Band Bühne"
  },
  {
    time: "2025-07-26 15:30:00",
    las: 96.5,
    station: "Band Bühne"
  },
  {
    time: "2025-07-26 23:45:00",
    las: 94.2,
    station: "Band Bühne"
  }
];

console.log('🧪 Testing warning display logic...\n');

testRows.forEach((row, index) => {
  console.log(`📊 Test ${index + 1}:`);
  console.log(`   Time: ${row.time}`);
  console.log(`   LAS: ${row.las} dB`);
  console.log(`   Station: ${row.station}`);
  
  const alarm = getAlarmThresholdForRow(row, mockConfig);
  const warning = getWarningThresholdForRow(row, mockConfig);
  
  console.log(`   Alarm threshold: ${alarm || 'undefined'}`);
  console.log(`   Warning threshold: ${warning || 'undefined'}`);
  
  let status = "Normal";
  if (alarm && row.las >= alarm) {
    status = "ALARM";
  } else if (warning && row.las >= warning) {
    status = "WARNING";
  }
  
  console.log(`   Status: ${status}`);
  console.log('');
});

console.log('✅ Warning logic test completed!'); 