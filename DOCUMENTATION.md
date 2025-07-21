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

---

## 1. Project Overview

The **Noise Monitoring Dashboard** is a real-time web platform for environmental noise and weather monitoring at various locations. It provides comprehensive data visualization, automated CSV processing, and intelligent alerting systems.

### Core Purpose
- Real-time noise level monitoring across multiple stations
- Weather data correlation and analysis
- Automated data processing from CSV files
- Browser-based notifications for threshold breaches
- Progressive Web App (PWA) functionality

---

## 2. Implemented Features

### 📊 **Real-Time Monitoring**
- **Live Data**: Continuous noise level monitoring from multiple stations
- **Weather Integration**: Wind speed, direction, and humidity correlation
- **Threshold Alerts**: Automatic notifications for limit breaches
- **Responsive Design**: Optimized for desktop and mobile devices

### 📈 **Chart Visualization**
- **Flexible Intervals**: 
  - Time periods: 7days,24hours
  - Granularity: 10-minute averages, 5-minute averages,1minute values
- **Data Limitation**: All charts display maximum 50points for optimal performance
- **Interactive Charts**: Recharts-based diagrams with weather overlay
- **Station-specific**: Individual dashboards for each location

### 🔔 **Notification System**
- **Push Notifications**: Immediate alerts for threshold breaches
- **Multi-level Warnings**: 55 dB (Warning) and 60B (Alarm)
- **Anti-spam**: Intelligent notification throttling
- **Browser Permissions**: Secure permission requests

### 🔄 **Automated Data Processing**
- **CSV Watcher**: Automatic detection of new CSV files
- **Database Integration**: Immediate processing and storage
- **Duplicate Detection**: Prevents duplicate processing
- **Performance Optimization**: Fast database queries

### 📱 **PWA Features**
- **Mobile Installation**: "Add to Home Screen" functionality
- **Offline Capability**: Service worker for caching
- **Native App Experience**: Full-screen mode and splash screen

### 🎨 **User Interface**
- **Intelligent Tooltips**: Contextual help and explanations
- **Consistent KPI Cards**: Standardized display across all stations
- **Status Badges**: Dynamic status indicators
- **Export Function**: CSV export for data analysis

---

## 3. System Architecture

### Frontend Architecture
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

### Frontend
- **Next.js 15**: React framework with App Router
- **React 18**: UI library with hooks
- **TypeScript**: Type safety and development experience
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Animation library
- **Recharts**: Chart library for data visualization

### Backend
- **SQLite**: Lightweight database
- **better-sqlite3**: High-performance SQLite client
- **Papa Parse**: CSV parsing library
- **Node.js**: Runtime environment

### External Services
- **Weather API**: Weisserstein.info for weather data
- **Browser Notifications**: Native notification system

### Development Tools
- **pnpm**: Package manager
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Static type checking

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

### Prerequisites
- Node.js 18 pnpm (recommended) or npm
- SQLite3

### Installation Steps

1. **Clone Repository**
```bash
git clone <repository-url>
cd noise-monitoring-dashboard
```

2. **Install Dependencies**
```bash
pnpm install
```

3. **Setup CSV Data**
```bash
# Create CSV directories
mkdir -p public/csv/{ort,heuballern,techno,band}

# Add CSV files to respective directories
# Format: Systemzeit;LAS;LAF;...
```

4. **Start Development Server**
```bash
pnpm dev
```

5. **Access Application**
```
http://localhost:3000
```

### Environment Variables
```env
# Optional: Custom database path
DATABASE_PATH=./data.sqlite

# Optional: Weather API configuration
WEATHER_API_URL=https://weisserstein.info
```

---

## 7. Configuration

### Station Configuration
Stations are configured in the file structure:
- `public/csv/[station-name]/` - CSV data directory
- `app/dashboard/[station-name]/` - Dashboard page
- `hooks/useStationData.ts` - Data fetching logic

### Threshold Configuration
```typescript
// In hooks/useStationData.ts
const WARNING_THRESHOLD = 55 // dB
const ALARM_THRESHOLD =60    // dB
```

### Weather Update Interval
```typescript
// In lib/db.ts
const WEATHER_UPDATE_INTERVAL = 10/ minutes
```

### Chart Configuration
```typescript
// Available intervals
const TIME_INTERVALS = [24h", "7d"]
const GRANULARITY_OPTIONS =10in", "5min",1min"]
const MAX_DATA_POINTS = 50

---

## 8. Usage Guide

### Dashboard Navigation
- **All Stations**: Overview of all stations with click navigation
- **Individual Stations**: Detailed views per location
- **Data Export**: CSV export for analysis

### Chart Controls
1. **Interval Selection**:
   - 7s: Shows data from the last 7 days
   - 24 Hours: Shows data from the last 24urs2nularity Selection**:
   - 10e Average: Average over10minute blocks
   -5e Average: Average over 5minute blocks
   - 1-Minute Value: Individual values per minute
3. **Data Display**:
   - Maximum 50points for optimal performance
   - Real-time updates every 30 seconds
   - Weather overlay integration

### Notification Setup
1. **Browser Permission**: Grant notification permission when prompted2**Automatic Alerts**: Receive alerts for threshold breaches3ound Notifications**: Removed for better UX

### PWA Features
- **Mobile Installation**: "Add to Home Screen" button
- **Offline Functionality**: Service worker for caching
- **Native App Feeling**: Full-screen mode and splash screen

### Data Export
1. Navigate to Export page2Select station and time period
3. Download CSV file

---

## 9. API Reference

### Station Data API
```typescript
GET /api/station-data?station={station}&interval={interval}&granularity={granularity}

Parameters:
- station: string (ort|heuballern|techno|band)
- interval: string (24|7ranularity: string (10in|1min)

Response:
[object Object]
  time: string;
  las: number;
  ws: number;
  wd: string;
  rh: number;
}[]
```

### Weather API
```typescript
GET /api/weather

Response:
{
  windSpeed: number;
  windDir: string;
  relHumidity: number;
}
```

### CSV Processing API
```typescript
POST /api/process-csv

Body:
{
  station: string;
  action: "process" |status;
}
```

---

## 10. Database Schema

### Measurements Table
```sql
CREATE TABLE measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station TEXT NOT NULL,
  time TEXT NOT NULL,
  las REAL NOT NULL,
  source_file TEXT,
  UNIQUE(station, time)
);
```

### Weather Table
```sql
CREATE TABLE weather (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station TEXT NOT NULL,
  time TEXT NOT NULL,
  windSpeed REAL,
  windDir TEXT,
  relHumidity REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(station, time)
);
```

### Indexes
```sql
CREATE INDEX idx_measurements_station_time ON measurements(station, time);
CREATE INDEX idx_weather_station_time ON weather(station, time);
CREATE INDEX idx_measurements_source_file ON measurements(source_file);
```

---

## 11. Security & Privacy

### Data Privacy
- **Local Storage**: All data stored locally in SQLite
- **No External Tracking**: No analytics or tracking services
- **Browser Permissions**: Secure notification permission requests
- **HTTPS Required**: PWA features require HTTPS in production

### Security Measures
- **Input Validation**: All API inputs validated
- **SQL Injection Prevention**: Parameterized queries
- **File System Security**: Restricted file access
- **Error Handling**: Comprehensive error management

### Privacy Compliance
- **GDPR Compliant**: No personal data collection
- **Local Processing**: All data processing on local server
- **User Consent**: Explicit permission for notifications
- **Data Retention**: Configurable data retention policies

---

## 12. Deployment

### Production Build
```bash
# Build application
pnpm build

# Start production server
pnpm start
```

### Environment Setup
```bash
# Set production environment
NODE_ENV=production

# Configure database path
DATABASE_PATH=/path/to/production/data.sqlite
```

### Docker Deployment
```dockerfile
FROM node:18lpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000CMD ["npm",start]
```

### Reverse Proxy Configuration
```nginx
server[object Object]    listen 80  server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:30
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 13. Troubleshooting

### Common Issues

#### Weather Data Not Updating
- Check internet connection
- Verify weather API status
- Clear database cache
- Check API rate limits

#### Notifications Not Working
- Verify browser permissions
- HTTPS required for notifications
- Test browser compatibility
- Check notification settings

#### CSV Data Not Loading
- Verify file path and format
- Validate column names (LAS vs LAF)
- Check file permissions
- Review CSV watcher status

#### PWA Installation Issues
- HTTPS required for PWA features
- Check browser compatibility
- Verify service worker status
- Test manifest file

#### Chart Performance Issues
- Reduce data points (max 50eck browser memory usage
- Verify data aggregation
- Monitor API response times

### Debug Mode
```bash
# Enable debug logging
DEBUG=* pnpm dev

# Check database health
curl http://localhost:3000pi/health
```

### Log Analysis
```bash
# View application logs
tail -f logs/app.log

# Check error logs
grep "ERROR" logs/app.log
```

### Fehlerbenachrichtigung (Toast & Push)

- Kritische Fehler (z.B. Integritätsprobleme, Import-/Backup-/Restore-Fehler) werden im API-Response mit `notify: true` gekennzeichnet.
- Das Admin-Frontend zeigt dann automatisch einen destruktiven Toast und – falls erlaubt – eine Browser-Push-Notification an.
- Beispiel-Response:
  ```json
  { "success": false, "error": "Fehler beim Backup", "notify": true }
  ```
- Vorteil: Keine E-Mail/Slack nötig, User sieht sofort im UI und per Push, wenn ein kritischer Fehler auftritt.

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

---

**Documentation Version**: 2.0
**Last Updated**: December 224  
**Maintained By**: Development Team 

# Änderungen ab Juni 2024

- Wetterdaten werden im Frontend immer in Europe/Berlin angezeigt (Zeitzonen-Korrektur per UTC-ISO-String).
- API-Response: Wetterwerte (ws, wd, rh, temp) sind null, wenn keine Daten für den Messzeitpunkt vorliegen (keine Defaultwerte mehr).
- CSV-Import synchronisiert Wetterdaten nur für aktuelle Zeitblöcke (max. 10 Minuten in der Vergangenheit, 5 Minuten in der Zukunft). Für alte CSVs werden keine aktuellen Wetterdaten gespeichert.
- Im Build/Production-Modus läuft der CSV-Watcher dauerhaft und verarbeitet neue/aktualisierte CSV-Dateien automatisch.
- Die Konfiguration csvAutoProcess steuert, ob der CSV-Watcher aktiv ist.
- Die Konfiguration enableNotifications steuert, ob Benachrichtigungen im Frontend angezeigt werden. 

# Berechnungsgrundlage & Schwellenwerte

## 1-Minuten-Ansicht (granularity = "1min")
- Jeder Messwert aus der Datenbank/CSV entspricht genau einem Zeitblock (1 Minute).
- Der dB-Wert pro Block ist der Einzelwert aus der Messung.
- Der eingestellte `calculationMode` (max, average, median) ist für 1min-Blöcke ohne Auswirkung, da es nur einen Wert gibt.

## Schwellenwerte
- Die Schwellenwerte für Warnung und Alarm werden aus der aktuellen Konfiguration (`/api/admin/config`) übernommen:
  - `warningThreshold` (z.B. 55 dB)
  - `alarmThreshold` (z.B. 60 dB)
- Optional: Weitere Schwellenwerte wie `lasThreshold`, `lafThreshold` können für spezielle Auswertungen genutzt werden.

## Statusanzeige (Frontend)
- Die Statusanzeige (Normal, Warnung, Alarm) erfolgt durch Vergleich des aktuellen Werts mit den Schwellenwerten:
  - **Warnung:** Wert ≥ `warningThreshold`
  - **Alarm:** Wert ≥ `alarmThreshold`
  - **Normal:** Wert < `warningThreshold`
- Die Schwellenwerte werden im Chart als Referenzlinien angezeigt.

## Zusammenfassung
- Die Berechnungsgrundlage für die 1-Minuten-Ansicht ist immer der Einzelwert.
- Die Schwellenwerte sind vollständig konfigurierbar und werden systemweit angewendet.
- Die Logik ist zentral dokumentiert und kann jederzeit angepasst werden. 

# Automatische Backups

- Die Anwendung erstellt täglich um 3 Uhr morgens automatisch ein Backup der Datenbank (`data.sqlite`) im Verzeichnis `backups/`.
- Die Backups werden als `backup-YYYY-MM-DD_HH-mm.sqlite` abgelegt.
- Backups können im Admin-Panel heruntergeladen und über die Restore-Funktion wiederhergestellt werden.
- Restore-Tests sollten regelmäßig durchgeführt werden, um die Integrität der Backups zu gewährleisten. 

# Changelog

## Neueste Änderungen

### Admin-Dashboard (Standalone)
- Admin-Bereich ist jetzt ein eigenständiges Dashboard, nicht mehr in der Haupt-Sidebar.
- Modernes UI mit shadcn/ui und App-Theme.
- Segmentierte Navigation: Systemübersicht, Schwellenwerte, CSV & Import, Backup & Restore, Datenkorrektur.

### CSV & Import
- CSV-Dateien pro Station einsehbar und uploadbar (Drag&Drop).
- Watcher-Status, Heartbeat und Import-Status sichtbar.
- Fehler- und Statusanzeigen für Uploads.

### Datenkorrektur
- Suche, Filter, Editieren und Löschen von Messwerten und Wetterdaten.
- Statistiken: Anzahl, letzte Änderung pro Station/Typ.
- Sofortige Aktualisierung nach Bearbeitung/Löschung.

### Dynamische Schwellenwerte
- Schwellenwerte (Warnung, Alarm, LAS, LAF) pro Station und Zeitblock konfigurierbar.
- Anwendung der Schwellenwerte in allen Dashboards, Tabellen, Exporten und Benachrichtigungen.

### Zeit- und Datumsfixes
- Messwerte enthalten jetzt vollständigen Zeitstempel (`datetime`).
- "Letzte Aktualisierung" und Chart-Zeiten zeigen korrekte Messzeit (Europe/Berlin).
- Wetterdaten werden synchron zu Messwerten importiert und angezeigt.

### Robustheit & Performance
- Automatische tägliche Backups der Datenbank.
- Fehlerbehandlung und Push-Benachrichtigungen für kritische Fehler.
- Batch-Import und Transaktionen für große CSV-Dateien.
- Circular Dependency-Fixes im Backend.

---

Weitere Details und API-/Fehlerdokumentation folgen. 

# API- und Fehlerdokumentation

## Admin-API-Endpunkte

### 1. /api/admin/correction-data
- **Methode:** GET
- **Parameter (Query):**
  - `station` (string, z.B. 'ort')
  - `type` ('measurement' | 'weather')
  - `q` (string, optional, Suchbegriff)
- **Antwort:** Array von Datensätzen `{ id, datetime, value, time }`
- **Fehler:** 500 bei DB-Fehlern

### 2. /api/admin/correction-edit
- **Methode:** POST
- **Body:** JSON `{ id, value, type }`
- **Antwort:** `{ success: true }` oder `{ success: false, message }`
- **Fehler:**
  - Fehlende Parameter: `{ success: false, message }`
  - DB-Fehler: `{ success: false, message }`

### 3. /api/admin/correction-delete
- **Methode:** POST
- **Body:** JSON `{ id, type }`
- **Antwort:** `{ success: true }` oder `{ success: false, message }`
- **Fehler:**
  - Fehlende Parameter: `{ success: false, message }`
  - DB-Fehler: `{ success: false, message }`

### 4. /api/admin/correction-stats
- **Methode:** GET
- **Parameter (Query):**
  - `station` (string)
  - `type` ('measurement' | 'weather')
- **Antwort:** `{ count, lastModified }`
- **Fehler:** 500 bei DB-Fehlern

### 5. /api/csv-watcher-status
- **Methode:** GET
- **Antwort:**
  - `watcherActive` (bool)
  - `watcherHeartbeat` (ISO-String)
  - `watchedDirectories` (Array mit Station, fileCount, files)
  - `totalFiles` (number)
- **Fehler:** 500 bei Systemfehlern

### 6. /api/admin/backup-db
- **Methode:** GET
- **Antwort:** Download der aktuellen Datenbank (data.sqlite)
- **Fehler:** 500 bei Dateisystemfehlern

### 7. /api/admin/factory-reset
- **Methode:** POST
- **Antwort:** `{ success: true }` oder `{ success: false, message }`
- **Fehler:**
  - DB- oder Dateisystemfehler: `{ success: false, message }`

## Fehlerhandling-Konzept
- Alle API-Routen geben im Fehlerfall ein konsistentes JSON `{ success: false, message }` zurück.
- Fehler werden im Admin-UI klar angezeigt (rote Meldung).
- Kritische Fehler (z.B. Watcher-Ausfall, Backup-Fehler) lösen Push-Benachrichtigungen aus.
- Fehlerdetails werden im System-Log gespeichert und sind im Admin-Dashboard einsehbar.

---

Weitere Endpunkte und Details werden fortlaufend ergänzt. 

## Wetterdaten-Handling (ab Version [heutiges Datum])
- Es gibt keine Fallback- oder Defaultwerte mehr für Wetterdaten.
- Wenn keine echten Wetterdaten (weder live noch aus der DB) vorliegen, liefert die API für Wetterdaten:
  - windSpeed: null
  - windDir: null
  - relHumidity: null
  - temperature: null
  - noWeatherData: true
- Das Frontend zeigt dann 'keine Wetterdaten verfügbar' an und verwendet keine Platzhalterwerte mehr in Statistiken oder Charts. 

## Changelog
- [heutiges Datum]: Wetterdaten liefern keine Fallback- oder Defaultwerte mehr. Wenn keine echten Wetterdaten vorliegen, gibt die API null-Werte und ein 'noWeatherData: true'-Flag zurück. Statistiken und Charts zeigen dann 'keine Daten' an. 

## Juni 2024
- Einführung automatisierter Tests (Vitest, Testing Library)
- Abdeckung: Unit-Tests für Parsing, Wetter, Schwellenwerte; API-Tests für Fehlerfälle; UI-Tests für Validierung und Interaktion
- Mocking von Wetter-API und Browser-APIs (matchMedia)
- Fehlerquellen (Aliase, React, jsdom, Request-Mocks) gelöst
- Teststrategie und Qualitätskonzept dokumentiert

---

## 15. Automated Testing & Quality Assurance

### Test Strategy
- **Unit-Tests**: Für alle kritischen Hilfsfunktionen (CSV-Parsing, Wetterdaten, Schwellenwertlogik)
- **API-Tests**: Für Next.js-API-Handler (z.B. /api/station-data, /api/weather), inkl. Fehlerfälle und Response-Validierung
- **UI-Tests**: Für zentrale Komponenten (Formulare, Threshold-Tab, Card-Komponenten) mit Testing Library
- **Mocking**: Externe APIs (z.B. Wetter) und Browser-APIs (z.B. matchMedia) werden für Tests gemockt

### Test Execution
- **Test-Framework**: [Vitest](https://vitest.dev/) für alle Testarten
- **Testlauf**:
  ```bash
  pnpm test
  ```
- **CI/CD**: Tests laufen headless und sind für Continuous Integration vorbereitet

### Coverage & Best Practices
- **Fehlerfälle**: Alle API- und Parsingfunktionen werden auf Fehler und Grenzfälle getestet
- **Validierung**: UI-Tests prüfen Validierung und Fehlermeldungen (z.B. E-Mail-Validierung im Admin)
- **Regression**: Tests sichern gegen versehentliche Änderungen an Kernlogik ab

### Beispiel-Testfälle
- CSV-Parsing: Leere, fehlerhafte und korrekte CSVs
- Wetterdaten: Erfolgreiche und fehlerhafte API-Responses, Fallback-Logik
- API: Fehlende Parameter, Rate-Limiting, korrekte Datenstruktur
- UI: Threshold-Tab, Formularvalidierung, Fehleranzeigen 

### CSV-Import: Fallback-Logik für Datum

- Wenn in einer CSV-Zeile kein explizites Datum (Spalte 'Datum' oder 'Date') vorhanden ist, wird das Änderungsdatum der CSV-Datei als Datum für die Messung verwendet.
- Dies stellt sicher, dass auch unvollständige CSVs verarbeitet werden können, aber das tatsächliche Messdatum kann abweichen, wenn die Datei nachträglich verändert wurde.
- Siehe auch Kommentar im Code (`lib/csv-processing.ts`). 

### Integritäts-Check nach Migrationen

- Nach jeder Migration wird geprüft, ob in der Tabelle `measurements` in den NOT NULL-Spalten (`station`, `time`, `las`) NULL-Werte vorkommen.
- Falls ja, wird eine Warnung im Log ausgegeben.
- Ziel: Früherkennung von Dateninkonsistenzen nach Schema-Änderungen. 

## 16. Robustheit & Monitoring

### Automatischer Health-Check
- Täglicher Integritäts-Check (per cron), prüft DB-Integrität, Wetterdaten, Messwerte
- Bei Problemen wird ein notify-Flag gesetzt und ein Systemhinweis im Admin angezeigt

### Fehlerklassen & zentrales Logging
- Fehler werden mit Klasse (ValidationError, DatabaseError, ImportError, ExternalApiError) und Kontext ins Log geschrieben
- Log-Analyse erkennt wiederkehrende Fehler und setzt notify-Flag

### notify-Mechanismus & UI-Benachrichtigung
- Kritische Fehler (API, Import, Backup, Restore, Korrektur, Schwellenwert, Rebuild) liefern notify: true im Response
- Admin-UI zeigt Toast, Push-Notification und System-Banner bei notify-Fehlern

### System-Banner
- Zeigt prominente Warnung im Admin-UI bei Integritätsproblemen oder wiederkehrenden Fehlern
- Fragt /api/admin/monitoring-status ab

### Teststrategie
- Integrationstests für alle notify/Fehlerfälle (API, UI, Push)
- Health-Check und Monitoring werden regelmäßig getestet

### Monitoring
- Tägliche Log-Analyse auf wiederkehrende Fehler (ImportError, DatabaseError, Integritätsprobleme)
- Systemhinweis im Admin-UI bei Überschreiten von Schwellwerten 

## API-Änderungen & Performance

- **API-Response:** `/api/station-data` liefert jetzt immer ein Objekt `{ data, totalCount }`.
- **Pagination:** Optional können `page` und `pageSize` als Query-Parameter übergeben werden. Die API liefert dann nur die gewünschte Seite.
- **Performance:** Tabellen im Dashboard laden nur noch die aktuelle Seite, nicht mehr alle Daten auf einmal.
- **Fehlerbenachrichtigung:** Kritische Fehler werden mit `notify: true` im API-Response markiert. Das Frontend zeigt dann einen destruktiven Toast und (falls erlaubt) eine Push-Notification. Keine E-Mail/Slack-Benachrichtigung mehr.
- **Robustheit & Monitoring:**
  - Automatischer Health-Check prüft täglich die Datenbank und Wetterdaten.
  - System-Banner im Admin-UI bei Integritätsproblemen oder wiederkehrenden Fehlern.
  - Zentrales Logging mit Fehlerklassen (ValidationError, DatabaseError, ImportError, ExternalApiError).

## Tests & Qualitätssicherung (Update)

- **API-Tests:** Prüfen jetzt auch Pagination und das neue Response-Format `{ data, totalCount }`.
- **Performance-Tests:** Sicherstellen, dass große Datenmengen paginiert und performant verarbeitet werden.
- **UI-Tests:** Prüfen, dass Fehler und Systemwarnungen korrekt als Toast/Push angezeigt werden. 