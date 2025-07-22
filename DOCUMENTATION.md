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
- Centralized, reusable components for all station dashboards (see codebase for details)

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

- All global settings (chart limit, pagination, default interval/granularity, chart colors) are configurable in the Admin Panel under "Einstellungen".
- Thresholds are fully configurable per station and time block.
- CSV watcher and notification system can be enabled/disabled via config.

---

## 8. Usage Guide

- All error and status notifications are shown as toast and (optionally) push notifications.
- Weather data is always shown in Europe/Berlin timezone.
- If no weather data is available, the UI shows 'keine daten' instead of numeric 0.
- All charts and tables are paginated for performance.

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

**Documentation Version**: 2.1
**Last Updated**: July 2024
**Maintained By**: Development Team 