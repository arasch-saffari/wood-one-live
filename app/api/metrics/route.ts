// NextResponse wird nicht benötigt
import client from 'prom-client'
import fs from 'fs'
import path from 'path'

// Prometheus Registry
const register = new client.Registry()
client.collectDefaultMetrics({ register })

// Custom Metrics
const importDuration = new client.Gauge({
  name: 'csv_import_duration_seconds',
  help: 'Dauer des letzten CSV-Imports in Sekunden',
})
const apiLatency = new client.Histogram({
  name: 'api_request_duration_seconds',
  help: 'API-Request-Latenz in Sekunden',
  labelNames: ['route']
})
const dbSizeGauge = new client.Gauge({
  name: 'db_file_size_bytes',
  help: 'Datenbankgröße in Bytes',
})
const errorCounter = new client.Counter({
  name: 'app_errors_total',
  help: 'Anzahl der Fehler im System',
  labelNames: ['type']
})
const memoryRssGauge = new client.Gauge({
  name: 'memory_rss_bytes',
  help: 'Resident Set Size (RAM) des Node-Prozesses in Bytes',
})
const cpuUserGauge = new client.Gauge({
  name: 'cpu_user_seconds_total',
  help: 'CPU-User-Zeit des Node-Prozesses in Sekunden',
})
const cpuSystemGauge = new client.Gauge({
  name: 'cpu_system_seconds_total',
  help: 'CPU-System-Zeit des Node-Prozesses in Sekunden',
})
register.registerMetric(importDuration)
register.registerMetric(apiLatency)
register.registerMetric(dbSizeGauge)
register.registerMetric(errorCounter)
register.registerMetric(memoryRssGauge)
register.registerMetric(cpuUserGauge)
register.registerMetric(cpuSystemGauge)

// Cleanup-Handler für Intervals
let dbSizeInterval: NodeJS.Timeout | null = null
let processMetricsInterval: NodeJS.Timeout | null = null

// Cleanup-Funktion
function cleanupMetricsIntervals() {
  if (dbSizeInterval) {
    clearInterval(dbSizeInterval)
    dbSizeInterval = null
  }
  if (processMetricsInterval) {
    clearInterval(processMetricsInterval)
    processMetricsInterval = null
  }
}

// Registriere Cleanup nur einmal
declare global {
  var metricsCleanupRegistered: boolean | undefined
}

if (!global.metricsCleanupRegistered) {
  process.on('SIGINT', cleanupMetricsIntervals)
  process.on('SIGTERM', cleanupMetricsIntervals)
  global.metricsCleanupRegistered = true
}

// DB-Size regelmäßig aktualisieren
function updateDbSize() {
  try {
    const dbPath = path.join(process.cwd(), 'data.sqlite')
    if (fs.existsSync(dbPath)) {
      const size = fs.statSync(dbPath).size
      dbSizeGauge.set(size)
    }
  } catch (error) {
    console.error('Error updating DB size metric:', error)
  }
}
dbSizeInterval = setInterval(updateDbSize, 60_000)
updateDbSize()

function updateProcessMetrics() {
  try {
    const mem = process.memoryUsage()
    memoryRssGauge.set(mem.rss)
    const cpu = process.cpuUsage()
    cpuUserGauge.set(cpu.user / 1e6) // microseconds → seconds
    cpuSystemGauge.set(cpu.system / 1e6)
  } catch (error) {
    console.error('Error updating process metrics:', error)
  }
}
processMetricsInterval = setInterval(updateProcessMetrics, 10000)
updateProcessMetrics()

export async function GET() {
  // Prometheus expects text/plain
  const metrics = await register.metrics()
  return new Response(metrics, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; version=0.0.4' }
  })
}

// Exportiere die Custom-Metriken für andere Module
export { importDuration, apiLatency, errorCounter } 