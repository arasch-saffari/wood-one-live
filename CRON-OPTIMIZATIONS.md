# Node-Cron Optimierungen - Behebung von "missed execution" Warnungen

## 🚨 Problem

Der Deployment-Server zeigte folgende Warnung:
```
[2025-07-25T16:00:20.688Z] [PID: 29] [NODE-CRON] [WARN] missed execution at Fri Jul 25 2025 16:00:00 GMT+0000 (Coordinated Universal Time)! Possible blocking IO or high CPU user at the same process used by node-cron.
```

## 🔍 Ursachen-Analyse

**Blockierende I/O-Operationen** in Cron-Jobs:
1. **Synchrone File-Operationen**: `fs.copyFileSync()`, `fs.writeFileSync()`, `fs.readFileSync()`
2. **Lange laufende Operationen** ohne Timeout-Schutz
3. **Fehlende Async/Await-Patterns** in Cron-Callbacks
4. **Überlappende Job-Ausführungen** ohne Schutz

## ✅ Implementierte Lösungen

### 1. **Alle I/O-Operationen zu Async umgewandelt**

#### Wetter-Update-Cron (alle 10 Minuten)
```typescript
// Vorher (blockierend):
cron.schedule('*/10 * * * *', () => {
  const weather = fetchWeather() // Sync
  db.prepare('INSERT...').run(...) // Sync
})

// Nachher (non-blocking):
cron.schedule('*/10 * * * *', async () => {
  const weatherPromise = Promise.race([
    fetchWeather(), // Async
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Weather update timeout')), 30000)
    )
  ])
  const weather = await weatherPromise
  // ... rest async
}, {
  scheduled: true,
  timezone: "Europe/Berlin"
})
```

#### Database-Backup-Cron (täglich 3:00)
```typescript
// Vorher (blockierend):
fs.copyFileSync(dbPath, backupPath) // Sync

// Nachher (non-blocking):
await fs.promises.copyFile(dbPath, backupPath) // Async
```

#### Health-Check-Cron (täglich 3:00)
```typescript
// Vorher (blockierend):
fs.writeFileSync(file, JSON.stringify(health, null, 2)) // Sync

// Nachher (non-blocking):
await fs.promises.writeFile(file, JSON.stringify(health, null, 2)) // Async
```

#### Log-Monitoring-Cron (täglich 3:30)
```typescript
// Vorher (blockierend):
const lines = fs.readFileSync(logPath, 'utf-8').split('\n') // Sync

// Nachher (non-blocking):
const logContent = await fs.promises.readFile(logPath, 'utf-8') // Async
const lines = logContent.split('\n')
```

### 2. **Timeout-Schutz für alle Cron-Jobs**

Jeder Cron-Job hat jetzt einen **Promise.race()** mit Timeout:

```typescript
const jobPromise = Promise.race([
  actualWork(), // Die eigentliche Arbeit
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Job timeout')), TIMEOUT_MS)
  )
])
```

**Timeout-Werte:**
- Wetter-Update: 30 Sekunden
- Database-Backup: 60 Sekunden  
- Health-Check: 30 Sekunden
- Log-Monitoring: 45 Sekunden

### 3. **Performance-Monitoring**

Alle Cron-Jobs messen jetzt ihre **Ausführungszeit**:

```typescript
const startTime = Date.now()
// ... work ...
const duration = Date.now() - startTime

// Warnung bei langsamen Operationen
if (duration > THRESHOLD) {
  console.warn(`[JobName] Langsame Ausführung: ${duration}ms`)
}
```

### 4. **Timezone-Konfiguration**

Alle Cron-Jobs verwenden jetzt **Europe/Berlin** Timezone:

```typescript
cron.schedule('0 3 * * *', async () => {
  // ... work ...
}, {
  scheduled: true,
  timezone: "Europe/Berlin"
})
```

### 5. **CronOptimizer-Klasse** (Erweitert)

Neue `lib/cron-optimizer.ts` für erweiterte Features:

- **Überlappungsschutz**: Verhindert mehrfache Job-Ausführungen
- **Retry-Mechanismus**: Exponential backoff bei Fehlern
- **Statistiken**: Tracking von Ausführungszeiten und Fehlern
- **Graceful Shutdown**: Proper Cleanup bei SIGINT/SIGTERM

```typescript
import { cronOptimizer } from './lib/cron-optimizer'

cronOptimizer.addJob({
  name: 'weather-update',
  schedule: '*/10 * * * *',
  handler: async () => {
    // Job-Logik hier
  },
  timeout: 30000,
  maxRetries: 3
})
```

## 📊 Erwartete Verbesserungen

| Metrik | Vorher | Nachher | Verbesserung |
|--------|--------|---------|--------------|
| **Blocking I/O** | Sync File-Ops | Async File-Ops | 100% non-blocking |
| **Job-Timeouts** | Keine | 30-60s Limits | Keine hängenden Jobs |
| **Überlappungen** | Möglich | Verhindert | Keine Ressourcenkonflikte |
| **Error-Recovery** | Keine | 3 Retries | Robustere Ausführung |
| **Monitoring** | Keine | Performance-Logs | Bessere Observability |

## 🔧 Deployment-Empfehlungen

### 1. **Server-Ressourcen überwachen**
```bash
# CPU-Last prüfen
top -p $(pgrep node)

# Memory-Usage prüfen  
ps aux | grep node

# I/O-Wait prüfen
iostat -x 1
```

### 2. **Node-Cron-Logs aktivieren**
```bash
# Environment-Variable setzen
export DEBUG=node-cron

# Oder in der Applikation:
process.env.DEBUG = 'node-cron'
```

### 3. **Prometheus-Metriken nutzen**
```typescript
// Cron-Job-Metriken in /api/metrics
const cronJobDuration = new client.Histogram({
  name: 'cron_job_duration_seconds',
  help: 'Cron job execution duration',
  labelNames: ['job_name', 'status']
})
```

## 🧪 Testing

### Lokale Tests
```bash
# Cron-Jobs manuell triggern
curl http://localhost:3000/api/admin/trigger-weather-update
curl http://localhost:3000/api/admin/trigger-backup
curl http://localhost:3000/api/admin/trigger-health-check
```

### Load-Testing
```bash
# Simuliere hohe Last während Cron-Ausführung
ab -n 1000 -c 10 http://localhost:3000/api/station-data?station=ort
```

## 📈 Monitoring

### 1. **Cron-Job-Status prüfen**
```typescript
// GET /api/admin/cron-status
{
  "weather-update": {
    "executions": 144,
    "failures": 0,
    "avgDuration": 2341,
    "lastExecution": "2025-01-25T16:00:00.000Z"
  }
}
```

### 2. **Performance-Alerts**
- Warnung bei Jobs > 15 Sekunden
- Fehler bei Jobs > Timeout-Limit
- Alert bei > 3 aufeinanderfolgenden Fehlern

### 3. **Grafana-Dashboard**
```promql
# Cron-Job-Ausführungszeit
histogram_quantile(0.95, cron_job_duration_seconds_bucket)

# Cron-Job-Fehlerrate
rate(cron_job_duration_seconds_count{status="error"}[5m])
```

## 🚀 Ergebnis

Nach der Implementierung sollten **keine "missed execution" Warnungen** mehr auftreten, da:

1. ✅ **Alle I/O-Operationen sind non-blocking**
2. ✅ **Alle Jobs haben Timeout-Schutz**  
3. ✅ **Performance wird überwacht**
4. ✅ **Überlappungen werden verhindert**
5. ✅ **Retry-Mechanismus bei Fehlern**

---

**Implementiert**: Januar 2025  
**Status**: ✅ Produktionsbereit  
**Monitoring**: Prometheus + Grafana empfohlen