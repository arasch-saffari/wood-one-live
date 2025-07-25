# Noise Monitoring Dashboard - Technical Documentation

---

## 📖 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Implemented Features](#2-implemented-features)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Project Structure](#5-project-structure)
6. [Installation & Setup](#6-installation--setup)
7. [Configuration](#7-configuration)
8. [Usage Guide](#8-usage-guide)
9. [API Reference](#9-api-reference)
10. [Database Schema](#10-database-schema)
11. [Security & Privacy](#11-security--privacy)
12. [Deployment](#12-deployment)
13. [Troubleshooting](#13-troubleshooting)
14. [Glossary](#14-glossary)
15. [Automated Testing & Quality Assurance](#15-automated-testing--quality-assurance)
16. [Robustness & Monitoring](#16-robustness--monitoring)
17. [Delta-Updates, Monitoring & Prometheus](#17-delta-updates--monitoring--prometheus)
18. [Performance Optimizations](#18-performance-optimizations)

---

## 1. Project Overview

The **Noise Monitoring Dashboard** is a real-time web platform for environmental noise and weather monitoring at various locations. It provides comprehensive data visualization, automated CSV processing, and intelligent alerting systems.

### Core Purpose
- Real-time noise level monitoring across multiple stations
- Weather data correlation and analysis (Open-Meteo API)
- Automated data processing from CSV files
- Browser-based notifications for threshold breaches (Toast & Push)
- Progressive Web App (PWA) functionality

---

## 2. Implemented Features

### 📊 **Real-Time Monitoring**
- **Live Data**: Continuous noise level monitoring from multiple stations
- **Weather Integration**: Wind speed, direction, humidity, and temperature via Open-Meteo API
- **Threshold Alerts**: Automatic notifications for limit breaches
- **Responsive Design**: Optimized for desktop and mobile devices

### 📈 **Chart Visualization**
- **Flexible Intervals**: 7 days, 24 hours
- **Granularity**: 15, 10, 5, 1 minute blocks
- **Data Limitation**: All charts display a configurable maximum number of points (default: 50)
- **Interactive Charts**: Recharts-based diagrams with weather overlay
- **Station-specific**: Individual dashboards for each location

### 🔔 **Notification System**
- **Push & Toast Notifications**: Immediate alerts for threshold breaches and critical errors
- **Multi-level Warnings**: Configurable warning and alarm thresholds
- **Anti-spam**: Intelligent notification throttling
- **Browser Permissions**: Secure permission requests

### 🔄 **Automated Data Processing**
- **CSV Watcher**: Automatic detection and processing of new CSV files
- **Database Integration**: Immediate processing and storage
- **Duplicate Detection**: Prevents duplicate processing
- **Performance Optimization**: Fast database queries, WAL mode

### 📱 **PWA Features**
- **Mobile Installation**: "Add to Home Screen" functionality
- **Offline Capability**: Service worker for caching
- **Native App Experience**: Full-screen mode and splash screen

### 🎨 **User Interface**
- **Intelligent Tooltips**: Contextual help and explanations (shadcn/ui)
- **Consistent KPI Cards**: Standardized display across all stations
- **Status Badges**: Dynamic status indicators
- **Export Function**: CSV/JSON export for data analysis
- **Wide Card Layout**: All admin and dashboard subpages use a wide, centered card style for clarity

### 🧩 **Modular Dashboard Components**
- Centralized, reusable components for all station dashboards
- **Zugvoegel Dashboard**: New unified dashboard combining data from multiple stations
- **Design Tokens**: Modern, airy design with gradients, primary colors, badge colors, card backgrounds, border radius, standard padding and spacing

### ⚙️ **Central Configuration System**
- **Admin Panel Settings**: Chart limit, pagination, intervals, granularities, chart colors
- **Database-Stored Thresholds**: All threshold configurations now stored in database
- **Real-time Updates**: Configuration changes apply immediately across all dashboards
- **Theme Support**: Light/dark mode with system preference detection

---

## 3. System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   Next.js 15    │   TypeScript    │
│   (Components)  │◄──►│   (Framework)   │◄──►│   (Type Safety) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Tailwind CSS  │    │   Framer Motion │    │   Recharts      │
│   (Styling)     │    │   (Animations)  │    │   (Charts)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Backend Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Routes    │    │   Database      │    │   CSV Watcher   │
│   (Next.js)     │◄──►│   (SQLite)      │◄──►│   (File System) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Weather API   │    │   Data Cache    │    │   Notifications │
│   (External)    │    │   (In-Memory)   │    │   (Browser)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flow
```
CSV Files → CSV Watcher → Database → API → Frontend → Charts
     ↓           ↓           ↓        ↓        ↓        ↓
  File System → Processing → Storage → Cache → State → Display
```

---

## 4. Technology Stack

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS, Framer Motion, Recharts, shadcn/ui
- **Backend**: SQLite (better-sqlite3), Node.js, Open-Meteo API, Papa Parse
- **Testing**: Vitest (unit, API, UI), Testing Library
- **Dev Tools**: pnpm, ESLint, Prettier

---

## 5. Project Structure

```
noise-monitoring-dashboard/
├── app/
│   ├── dashboard/
│   │   ├── all/              # Overview of all stations
│   │   ├── ort/              # Ort station
│   │   ├── heuballern/       # Heuballern station
│   │   ├── techno/           # Techno Floor station
│   │   ├── band/             # Band Bühne station
│   │   └── export/           # Data export
│   ├── zugvoegel/            # New unified dashboard
│   ├── admin/                # Admin panel with settings
│   ├── api/
│   │   ├── station-data/     # Station data API
│   │   ├── weather/          # Weather API
│   │   └── process-csv/      # CSV processing API
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Home page
│   └── globals.css           # Global styles
├── components/
│   ├── ui/                   # UI components (shadcn/ui)
│   └── theme-provider.tsx    # Theme provider
├── hooks/
│   └── useStationData.ts     # Data fetching hook
├── lib/
│   ├── db.ts                 # Database functions
│   ├── weather.ts            # Weather integration
│   ├── csv-watcher.ts        # CSV watcher
│   └── utils.ts              # Utility functions
├── public/
│   └── csv/                  # CSV data files
│       ├── ort/
│       ├── heuballern/
│       ├── techno/
│       └── band/
├── styles/
│   └── globals.css           # Global styles
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## 6. Installation & Setup

- Use `pnpm` for dependency management
- See README for up-to-date steps

---

## 7. Configuration

### Central Configuration System
- **Chart Settings**: Chart limit, pagination size, default intervals and granularities
- **Chart Colors**: Customizable color scheme for all charts and visualizations
- **Allowed Options**: Configurable intervals and granularities available to users
- **Database Storage**: All threshold configurations now stored in database with audit trail
- **Real-time Updates**: Changes apply immediately across all dashboards

### Admin Panel Features
- **Settings Tab**: Global system and chart options
- **Threshold Management**: Per-station and time-block threshold configuration
- **System Monitoring**: Health checks, integrity monitoring, backup management
- **Data Correction**: Edit and delete measurement and weather data
- **CSV Management**: Upload and process CSV files

---

## 8. Usage Guide

### Dashboard Navigation
- **Individual Stations**: `/dashboard/[station]` for station-specific views
- **All Stations**: `/dashboard/all` for combined overview
- **Zugvoegel Dashboard**: `/zugvoegel` for unified multi-station view
- **Admin Panel**: `/admin` for system configuration and management

### Key Features
- All error and status notifications are shown as toast and (optionally) push notifications
- Weather data is always shown in Europe/Berlin timezone
- If no weather data is available, the UI shows 'keine daten' instead of numeric 0
- All charts and tables are paginated for performance
- Tooltips provide contextual help throughout the interface

---

## 9. API Reference

### Station Data API
- `GET /api/station-data?station={station}&interval={interval}&granularity={granularity}&page={page}&pageSize={pageSize}`
- Returns `{ data: [...], totalCount: number }`
- Weather data fields are `null` if not available; no fallback values.

### Weather API
- `GET /api/weather?station={station}&time={time}`
- Returns `{ windSpeed, windDir, relHumidity, temperature, noWeatherData }`
- All fields are `null` and `noWeatherData: true` if no data is available.

### Admin & Correction APIs
- See section "API- und Fehlerdokumentation" below for all admin endpoints and error handling.

---

## 10. Database Schema

- See codebase for up-to-date schema. All migrations are handled automatically. Integrity checks run daily.
- **Thresholds Table**: Stores all threshold configurations with audit trail
- **Measurements Table**: Noise level data with weather correlation
- **Audit Tables**: Track changes to thresholds and data corrections

---

## 11. Security & Privacy

- All data is stored locally (SQLite). No external tracking.
- All API inputs are validated. Parameterized queries prevent SQL injection.
- HTTPS is required for PWA and notifications in production.
- GDPR compliant: No personal data collected.

---

## 12. Deployment

- Use `pnpm build` and `pnpm start` for production.
- Docker and reverse proxy examples are in the codebase (see README for corrections).

---

## 13. Troubleshooting

### Common Issues
- **Weather Data Not Updating**: Check Open-Meteo API status, internet connection, and database cache.
- **Notifications Not Working**: Check browser permissions, HTTPS, and notification settings.
- **CSV Data Not Loading**: Check file path, format, and watcher status.
- **PWA Installation Issues**: Check HTTPS, browser compatibility, and service worker status.
- **Chart Performance Issues**: Reduce data points, check aggregation, monitor API response times.

### Debugging & Logs
- All critical errors are logged and shown as toast/push notifications in the admin UI.
- Use `DEBUG=* pnpm dev` for verbose logging.
- System health and integrity problems are shown as banners in the admin dashboard.

---

## 14. Glossary

### Technical Terms
- **LAS**: A-weighted sound pressure level
- **LAF**: A-weighted sound pressure level (fast)
- **dB**: Decibel, unit of sound measurement
- **PWA**: Progressive Web Application
- **CSV**: Comma-Separated Values file format
- **SQLite**: Lightweight database engine
- **API**: Application Programming Interface

### Feature Terms
- **Granularity**: Time interval for data aggregation
- **Threshold**: Noise level limits for alerts
- **Watcher**: Automated file monitoring system
- **Cache**: Temporary data storage for performance
- **Hook**: React function for state management
- **Component**: Reusable UI element

### Station Names
- **Ort**: General noise measurement location
- **Heuballern**: Special measurement station
- **Techno Floor**: Event area
- **Band Bühne**: Music event location

### New Terms
- **Open-Meteo**: External weather API used for all live weather data
- **Toast**: UI notification shown in-app
- **Zugvoegel**: Unified dashboard combining multiple station data
- **Design Tokens**: Centralized design system with consistent colors, spacing, and components

---

## 15. Automated Testing & Quality Assurance

- All tests use Vitest exclusively (unit, API, UI)
- Coverage includes: CSV parsing, weather, thresholds, API error cases, UI validation
- All API and UI error cases are tested (including notify: true and system banners)
- See codebase for test examples and coverage

---

## 16. Robustness & Monitoring

- Daily health checks and integrity checks (cron)
- All critical errors (ImportError, DatabaseError, ExternalApiError, etc.) are logged and shown in the admin UI
- System banners and toast/push notifications for all notify: true API responses
- Automatic daily database backups (see Admin Panel)
- All migrations and schema changes are logged and checked for integrity
- Weather data is never faked: If not available, all fields are `null` and the UI shows 'keine daten'
- All admin and dashboard subpages use a wide, centered card layout for clarity

---

## 17. Delta-Updates, Monitoring & Prometheus (Juli 2024)

- **Delta-Update-Architektur:**
  - Server-Sent-Events (SSE) für alle Kernbereiche (Messwerte, Wetter, Health, Logs, KPIs).
  - Frontend lädt Daten automatisch bei neuen Events nach, Polling bleibt als Fallback.
  - Optionale Erweiterung: WebSocket für bidirektionale Features.

- **Admin Monitoring Panel:**
  - Live-Status-Badges (OK/Warnung/Alarm) für Importdauer, API-Latenz, Fehlerzähler.
  - Mini-Linecharts für die letzten 10 Werte jeder Metrik.
  - Übersichtliche Prometheus-Metriken direkt im Admin-Dashboard.

- **Prometheus-Integration:**
  - Export von Importdauer, API-Latenz, Fehlerzähler, DB-Größe als /api/metrics (prom-client).
  - Einbindung in Grafana und Alerting möglich.

- **Fehlerbehebung SSE:**
  - Initialisierungsfehler im SSE-Stream (ReferenceError bei stream.cancel) behoben, robustes Cleanup implementiert.

- **Optionale Architektur:**
  - Prometheus-Alerting, gezielte Delta-Updates, automatisierte Tests und weitere Visualisierungen vorbereitet.

---

# API- und Fehlerdokumentation (Update Juli 2024)

## Wetterdaten-Handling
- Wetterdaten werden ausschließlich über die Open-Meteo API bezogen.
- Es gibt keine Fallback- oder Defaultwerte mehr für Wetterdaten. Wenn keine echten Wetterdaten (weder live noch aus der DB) vorliegen, liefert die API für Wetterdaten:
  - windSpeed: null
  - windDir: null
  - relHumidity: null
  - temperature: null
  - noWeatherData: true
- Das Frontend zeigt dann 'keine daten' an und verwendet keine Platzhalterwerte mehr in Statistiken oder Charts.

## Fehlerhandling-Konzept
- Alle API-Routen geben im Fehlerfall ein konsistentes JSON `{ success: false, message, notify? }` zurück.
- Kritische Fehler (z.B. Integritätsprobleme, Import-/Backup-/Restore-Fehler) werden im API-Response mit `notify: true` gekennzeichnet.
- Das Admin-Frontend zeigt dann automatisch einen destruktiven Toast und – falls erlaubt – eine Browser-Push-Notification an.
- Fehlerdetails werden im System-Log gespeichert und sind im Admin-Dashboard einsehbar.
- Integritätsprobleme in der Datenbank werden täglich geprüft und prominent im Admin-UI angezeigt.

## Admin-API-Endpunkte (Auszug)
- `/api/admin/correction-data` (GET): Datenkorrektur, Filter, Suche
- `/api/admin/correction-edit` (POST): Editieren von Messwerten/Wetterdaten
- `/api/admin/correction-delete` (POST): Löschen von Messwerten/Wetterdaten
- `/api/admin/correction-stats` (GET): Statistiken zu Korrekturen
- `/api/csv-watcher-status` (GET): Status des CSV-Watchers
- `/api/admin/backup-db` (GET): Download der aktuellen Datenbank
- `/api/admin/factory-reset` (POST): Zurücksetzen der Datenbank

## UI-Fehleranzeigen
- Alle Fehler werden als Toast und (bei notify: true) als Push angezeigt
- System-Banner bei Integritätsproblemen oder wiederkehrenden Fehlern
- Fehlerdetails sind im Admin-Panel einsehbar

## Tooltips (shadcn/ui)
- Alle KPI-Werte und Chart-Interaktionspunkte sind mit shadcn Tooltips versehen
- Tooltips sind barrierefrei und funktionieren mit Tastatur und Screenreader
- TooltipProvider ist im Root-Layout gesetzt

---

## Linting & Code Style

- Das Projekt verwendet ESLint mit einer modernen Konfiguration für Next.js, TypeScript, React und Prettier.
- Die Konfiguration befindet sich in `.eslintrc.js`.
- Linting ausführen:
  ```bash
  pnpm lint
  pnpm lint --fix
  ```
- Wichtige Regeln:
  - Keine `any`-Typen (Warnung)
  - Keine unbenutzten Variablen/Importe
  - Prettier-Formatierung ist Pflicht
  - React-Hooks nur im Top-Level
- Linting ist Pflicht vor jedem Commit/PR und wird in CI/CD geprüft.

---

**Documentation Version**: 2.2
**Last Updated**: December 2024
**Maintained By**: Development Team 

## Performance- und Robustheits-Optimierungen (2025-07)

### SQLite
- WAL-Modus, `cache_size = 50000` (ca. 50MB), `temp_store = MEMORY`, `synchronous = NORMAL` für bessere Performance bei großen Datenmengen.

### Monitoring
- Prometheus-Metriken für Importdauer, API-Latenz, DB-Größe, Fehler, RAM (`memory_rss_bytes`), CPU (`cpu_user_seconds_total`, `cpu_system_seconds_total`).

### Memory-Leak-Prävention
- Cleanup-Hooks für CSV-Watcher und SSE-Subscriber (SIGINT/SIGTERM, regelmäßiges Aufräumen).

### Wetter-API
- Gibt jetzt immer konsistente Objekte zurück, auch wenn keine Wetterdaten vorhanden sind (`time=now`).
- Frontend zeigt wieder korrekt Wetterdaten oder "keine Daten verfügbar" an.

### Frontend-Optimierungen
- Memoization für große Tabellen und Charts (React.memo)
- Hinweise und Vorbereitungen für virtuelles Scrolling (react-window)
- Ladeindikatoren und Fehlerbehandlung verbessert 

# Chart-Komponenten

## Multi-Line-Support
- Die Komponente `GenericChart` unterstützt jetzt beliebig viele Linien (lines[]), nicht mehr nur `las`.
- Für Multi-Station-Charts (z.B. Dashboard-Übersicht) können beliebige Messreihen als eigene Linien angezeigt werden.
- Thresholds werden als zusätzliche Linien gerendert und unterstützen eigene y-Achsen.

## Fehlerdiagnose
- Wenn ein Chart nicht angezeigt wird, prüfe die Browser-Konsole auf `[GenericChart] Keine Linie mit key ...`.
- Testcharts können einfach mit `<ChartPlayground data={[{...}]} lines={[...]} axes={[...]} />` eingefügt werden.

# Performance & Ressourcen
- SQLite ist mit WAL, `cache_size = 50000`, `temp_store = MEMORY`, `synchronous = NORMAL` konfiguriert.
- Cleanup für CSV-Watcher, SSE-Subscriber, Event-Listener und In-Memory-Listen ist implementiert.
- Prometheus-Metriken für RAM, CPU, DB-Größe, Importdauer, API-Latenz, Fehler sind aktiv.
- Health-API und Admin-Monitoring-Panel prüfen Systemressourcen und zeigen Alerts an. 

# 15min-Aggregation (Materialized View)

- Die 15min-Aggregation wird regelmäßig per Skript (`scripts/update-15min-agg.ts`) aktualisiert.
- Die API liest die Werte direkt aus der Tabelle `measurements_15min_agg`.
- Vorteil: Dashboards und Unterseiten laden auch bei sehr großen Datenmengen in <1s.
- Das Skript sollte per System-Cronjob alle 5 Minuten laufen (siehe README). 

## Memory-Leak-Fixes (Juni 2024)

- **EventSource-Singleton:** Alle Hooks (useStationData, useWeatherData, useHealth) verwenden jetzt eine gemeinsame EventSource-Instanz pro Seite. Listener werden gezählt und sauber entfernt. Dadurch werden Memory-Leaks und UI-Hänger verhindert.
- **SIGINT/SIGTERM-Listener-Singleton:** Cleanup-Listener für Prozessende werden jetzt nur noch einmalig registriert (Singleton-Pattern), um MaxListenersExceededWarning zu vermeiden.
- **Stabileres Hot-Reload:** Durch die Singleton-Pattern gibt es keine doppelten EventListener mehr bei Hot-Reload oder Navigation. Die Seite bleibt performant und stabil.

---

## 18. Performance Optimizations (Januar 2025)

### 🚀 **Umfassende Performance-Verbesserungen**

Das System wurde grundlegend optimiert, um Frontend-Hänger und Node-Cron "missed execution" Warnungen zu beheben.

### **Backend-Optimierungen**

#### **Node-Cron Optimierungen**
- **Asynchrone I/O-Operationen**: Alle `fs.copyFileSync()`, `fs.writeFileSync()`, `fs.readFileSync()` zu `fs.promises.*` umgewandelt
- **Timeout-Schutz**: Alle Cron-Jobs haben jetzt 30-60s Timeout mit `Promise.race()`
- **Performance-Monitoring**: Ausführungszeiten werden gemessen und bei langsamen Jobs gewarnt
- **Timezone-Konfiguration**: Alle Jobs verwenden `Europe/Berlin` Timezone
- **CronOptimizer-Klasse**: Erweiterte Features für Überlappungsschutz und Retry-Mechanismus

```typescript
// Beispiel: Async Backup-Cron mit Timeout
cron.schedule('0 3 * * *', async () => {
  const backupPromise = Promise.race([
    fs.promises.copyFile(dbPath, backupPath), // Non-blocking
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Backup timeout')), 60000)
    )
  ])
  await backupPromise
}, {
  scheduled: true,
  timezone: "Europe/Berlin"
})
```

#### **SQL-Level-Pagination**
- **Problem behoben**: API lud 50.000 Zeilen für Cache + JavaScript-slice()
- **Lösung**: Direkte LIMIT/OFFSET in SQL-Queries
- **Performance-Gewinn**: 99% weniger Datenübertragung

```typescript
// Vorher (LANGSAM):
const allData = stmt.all(station) // 50.000 Zeilen
const paged = allData.slice(start, end) // JavaScript-slice

// Nachher (SCHNELL):
const stmt = db.prepare(`
  SELECT * FROM measurements 
  WHERE station = ? 
  ORDER BY datetime DESC 
  LIMIT ? OFFSET ?
`)
const paged = stmt.all(station, limit, offset) // Nur benötigte Zeilen
```

### **Frontend-Optimierungen**

#### **PageSize-Reduktion**
- **Dashboard-Layout**: Von 4×50 auf 4×1 Datenpunkte für "Letzte Aktualisierung"
- **Chart-Komponenten**: Von 500 auf 100 Datenpunkte pro Chart
- **Tabellen**: Von 1000+ auf 25-100 Datenpunkte pro Request
- **Default-Werte**: useStationData Standard von 50 auf 25 reduziert

#### **Request-Optimierungen**
- **Timeout-Schutz**: 10s Timeout mit AbortController für alle API-Requests
- **Cache-Headers**: `Cache-Control: no-cache` für aktuelle Daten
- **Polling-Reduktion**: Von 60s auf 300s für Background-Updates

```typescript
// Request mit Timeout und AbortController
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 10000)

const response = await fetch(url, { 
  signal: controller.signal,
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
})
```

#### **React.memo-Optimierungen**
- **MemoizedStationDashboard**: Verhindert unnötige Re-Renders
- **Custom Comparison**: Nur re-rendern wenn sich relevante Props ändern
- **Performance-Gewinn**: Deutlich weniger CPU-Last bei Navigation

### **Erwartete Performance-Verbesserungen**

| Bereich | Vorher | Nachher | Verbesserung |
|---------|--------|---------|--------------|
| **API-Requests** | 50.000 Zeilen | 25-100 Zeilen | 99% weniger Daten |
| **Dashboard-Layout** | 4×50 Datenpunkte | 4×1 Datenpunkt | 98% weniger Requests |
| **Chart-Loading** | 500 Datenpunkte | 100 Datenpunkte | 80% weniger Daten |
| **Cron-Jobs** | Sync I/O | Async + Timeout | Keine Blockierung |
| **Request-Timeout** | Unbegrenzt | 10 Sekunden | Keine hängenden Requests |

### **Monitoring & Debugging**

#### **Performance-Metriken**
```typescript
// Cron-Job-Performance-Tracking
const startTime = Date.now()
// ... work ...
const duration = Date.now() - startTime

if (duration > THRESHOLD) {
  console.warn(`[JobName] Langsame Ausführung: ${duration}ms`)
}
```

#### **CronOptimizer-Features**
- **Überlappungsschutz**: Verhindert mehrfache Job-Ausführungen
- **Retry-Mechanismus**: Exponential backoff bei Fehlern
- **Statistiken**: Tracking von Ausführungszeiten und Fehlern
- **Graceful Shutdown**: Proper Cleanup bei SIGINT/SIGTERM

### **Deployment-Empfehlungen**

#### **Server-Monitoring**
```bash
# CPU-Last prüfen
top -p $(pgrep node)

# Memory-Usage prüfen  
ps aux | grep node

# I/O-Wait prüfen
iostat -x 1
```

#### **Prometheus-Metriken**
- `cron_job_duration_seconds`: Cron-Job-Ausführungszeit
- `api_request_duration_seconds`: API-Latenz mit Route-Labels
- `memory_rss_bytes`: RAM-Usage des Node-Prozesses
- `db_file_size_bytes`: SQLite-Datenbankgröße

### **Troubleshooting**

#### **Häufige Performance-Probleme**
- **Langsame API-Requests**: Prüfe pageSize-Parameter und SQL-Indizes
- **Frontend-Hänger**: Reduziere pageSize in useStationData-Hooks
- **Cron-Job-Timeouts**: Prüfe Prometheus-Metriken für Job-Dauer
- **Memory-Leaks**: Überwache RSS-Memory-Usage über Zeit

#### **Performance-Tests**
```bash
# API-Load-Testing
ab -n 1000 -c 10 http://localhost:3000/api/station-data?station=ort&pageSize=25

# Cron-Job-Status prüfen
curl http://localhost:3000/api/admin/cron-status
```

---

**Performance Optimizations Version**: 1.0  
**Last Updated**: Januar 2025  
**Status**: ✅ Produktionsbereit 