# Projekt-Notizen: Noise Monitoring Dashboard

## Projektstruktur

- **app/**
  - **dashboard/**: Einzelne Dashboards für jede Messstation (all, ort, heuballern, techno, band, export)
  - **zugvoegel/**: Neues einheitliches Dashboard kombiniert Daten von mehreren Stationen
  - **admin/**: Admin-Panel mit Einstellungen, Schwellenwerten, System-Monitoring
  - **api/**: API-Endpunkte (station-data, weather, process-csv, etc.)
  - **globals.css**: Globale Styles
- **components/**: UI-Komponenten (inkl. shadcn/ui)
- **hooks/**: Custom React Hooks (z.B. useStationData, useConfig)
- **lib/**: Utilities, Datenbank, CSV- und Wetterintegration
- **public/csv/**: CSV-Daten für jede Station
- **styles/**: Globale Styles
- **README.md, DOCUMENTATION.md**: Projektbeschreibung und technische Dokumentation

## Zentrale Komponenten & Datenflüsse

- **CSV-Datenfluss:**
  1. CSV-Dateien werden in `public/csv/[station]/` abgelegt
  2. CSV-Watcher erkennt neue Dateien (lib/csv-watcher.ts)
  3. Daten werden in SQLite-DB importiert (lib/db.ts)
  4. API-Endpunkte liefern Daten an das Frontend (app/api/)
  5. Frontend (app/dashboard/, app/zugvoegel/) visualisiert Daten in Charts (Recharts)

- **Wetterdaten:**
  - Open-Meteo API Integration (lib/weather.ts)
  - Integration über lib/weather.ts und API-Route app/api/weather/
  - Keine Fallback-Werte mehr, nur echte Daten

- **Benachrichtigungen:**
  - Browser-Push-Notifications bei Grenzwertüberschreitungen (Warnung/Alarm)
  - Toast-Komponente für UI-Benachrichtigung
  - System-Banner bei Integritätsproblemen

- **PWA:**
  - Installierbar, offlinefähig, Add-to-Home-Screen

## Neue Features (Dezember 2024)

### Zugvoegel Dashboard
- **Einheitliches Dashboard**: Kombiniert Daten von Ort, Techno Floor und Band Bühne
- **Multi-Station View**: Zeigt alle Stationen in einer übersichtlichen Ansicht
- **15-Minuten-Aggregation**: Automatische Gruppierung in 15-Minuten-Blöcken
- **Alarm-Filter**: Filtert nur Einträge mit Alarm-Grenzwertüberschreitungen
- **Wetter-Integration**: Zeigt aktuelle Wetterdaten mit allen Stationen
- **Responsive Design**: Optimiert für Desktop und Mobile

### Zentrale Konfiguration
- **Admin-Panel Settings**: Chart-Limit, Pagination, Intervall, Granularität, Chart-Farben
- **Datenbank-Thresholds**: Alle Schwellenwert-Konfigurationen jetzt in der Datenbank
- **Real-time Updates**: Änderungen wirken sich sofort auf alle Dashboards aus
- **Audit-Trail**: Alle Änderungen werden protokolliert
- **Theme Support**: Light/Dark Mode mit System-Präferenz-Erkennung

### Design Tokens
- **Modernes Design**: Luftiges Design mit Gradients und modernen UI-Elementen
- **Konsistente Farben**: Primärfarben, Badge-Farben, Chart-Farben
- **Card-Backgrounds**: bg-white/90, dark:bg-gray-900/80
- **Border-Radius**: rounded-2xl für moderne Optik
- **Standard-Padding**: Konsistente Abstände für Cards, Filterleisten, Tabellen

## Offene Fragen / Unklarheiten

- Gibt es noch Altlasten aus der PHP-Wetterintegration? → **Gelöst**: Vollständige Open-Meteo Integration
- Wie ist die genaue Logik für die Chart-Granularität? → **Gelöst**: 15-Minuten-Granularität implementiert
- Wie werden Push-Notifications technisch ausgelöst? → **Gelöst**: Service Worker implementiert
- Gibt es ein globales Stations-Array für die Sidebar/Sortierung? → **Gelöst**: STATION_META in lib/stationMeta.ts

## Aufwandsschätzung (grob)

| Bereich                | Aufwand (Stunden) | Status |
|------------------------|-------------------|---------|
| Chart: 15min + Mobile  | 2–3               | ✅ Erledigt |
| Heuballern sortieren   | 0.5               | ✅ Erledigt |
| Listenansicht alle     | 1–2               | ✅ Erledigt |
| Wetter: Open-Meteo     | 1                 | ✅ Erledigt |
| Push-Notifications     | 2–4               | ✅ Erledigt |
| PWA-Integration        | 1                 | ✅ Erledigt |
| Zugvoegel Dashboard    | 4–6               | ✅ Erledigt |
| Zentrale Konfiguration | 3–4               | ✅ Erledigt |
| **Gesamt**             | **13–21**         | **✅ Alle Features implementiert** |

## ToDo (siehe Aufgabenliste)

- [x] Charts: 15min-Granularität, Standard 15min, Mobile-Optimierung
- [x] Heuballern als letzten Eintrag (Sidebar & Dashboard)
- [x] Listenansicht aller Stationen
- [x] Wetter: Open-Meteo API, PHP entfernen
- [x] Push-Notifications Desktop/Mobile, Toast
- [x] PWA: Add-to-Home-Screen
- [x] Zugvoegel Dashboard: Einheitliches Multi-Station Dashboard
- [x] Zentrale Konfiguration: Admin-Panel Settings
- [x] Design Tokens: Modernes, luftiges Design

# Update Juni 2024

- Wetterdaten werden im Frontend immer in Europe/Berlin angezeigt (korrekte Zeitzone, kein UTC-Fehler mehr).
- Für Zeitpunkte ohne Wetterdaten (z.B. alte CSVs) werden alle Wetterwerte als null geliefert (kein 0 oder Platzhalter mehr).
- CSV-Watcher läuft jetzt auch im Build/Production-Modus und verarbeitet neue CSV-Dateien automatisch.
- Wetterdaten werden beim CSV-Import nur für aktuelle Zeitblöcke synchronisiert (keine aktuellen Wetterdaten für alte Messwerte).
- Konfigurationsoptionen csvAutoProcess und enableNotifications wirken systemweit. 

## Änderung: Wetterdaten ohne Fallbacks
- Wetterdaten liefern keine Fallback- oder Defaultwerte mehr.
- Wenn keine echten Wetterdaten vorliegen, gibt die API für alle Felder null und ein 'noWeatherData: true'-Flag zurück.
- Das Frontend zeigt dann 'keine Wetterdaten verfügbar' an und verwendet keine Platzhalterwerte mehr in Statistiken oder Charts. 

## Teststrategie & Lessons Learned

- **Automatisierte Tests**: Unit-Tests für Parsing, Wetter, Schwellenwerte; API-Tests für Fehlerfälle; UI-Tests für Validierung und Interaktion
- **Test-Framework**: Vitest + Testing Library
- **Mocking**: Wetter-API, Browser-APIs (matchMedia) werden gemockt
- **Fehlerquellen**: Aliase, React-Import, jsdom, Request-Mocks, matchMedia – alle gelöst
- **Empfehlung**: Bei neuen Features immer Unit- und UI-Tests ergänzen, API-Fehlerfälle abdecken
- **CI/CD**: Tests laufen headless und können in Pipelines integriert werden 

## Update Juli 2024: API, Performance, Monitoring

- **API-Response:** `/api/station-data` liefert jetzt immer `{ data, totalCount }`.
- **Pagination:** Über `page` und `pageSize` können gezielt Seiten abgefragt werden. Tabellen laden nur noch die aktuelle Seite.
- **Fehlerbenachrichtigung:** Kritische Fehler werden mit `notify: true` im API-Response markiert. Das Frontend zeigt Toast und Push-Notification, keine E-Mail/Slack mehr.
- **Health-Check & Monitoring:**
  - Automatischer täglicher Integritäts-Check der Datenbank und Wetterdaten
  - System-Banner im Admin-UI bei Problemen
  - Zentrales Logging mit Fehlerklassen
- **Teststrategie:** API-Tests prüfen jetzt auch Pagination und das neue Response-Format. 
- Zentrale Einstellungen (Chart-Limit, Pagination, Intervall, Granularität, Chart-Farben) sind jetzt im Admin-Panel unter Einstellungen editierbar.
- Die UI der Settings-Seite ist übersichtlich und an die Schwellenwert-Seite angelehnt. 

## Update Dezember 2024: Zugvoegel Dashboard & Zentrale Konfiguration

### Zugvoegel Dashboard
- **Neues einheitliches Dashboard**: Kombiniert Daten von Ort, Techno Floor und Band Bühne
- **Multi-Station View**: Zeigt alle Stationen in einer übersichtlichen Ansicht
- **15-Minuten-Aggregation**: Automatische Gruppierung in 15-Minuten-Blöcken
- **Alarm-Filter**: Filtert nur Einträge mit Alarm-Grenzwertüberschreitungen
- **Wetter-Integration**: Zeigt aktuelle Wetterdaten mit allen Stationen
- **Responsive Design**: Optimiert für Desktop und Mobile

### Zentrale Konfiguration
- **Admin-Panel Settings**: Chart-Limit, Pagination, Intervall, Granularität, Chart-Farben
- **Datenbank-Thresholds**: Alle Schwellenwert-Konfigurationen jetzt in der Datenbank
- **Real-time Updates**: Änderungen wirken sich sofort auf alle Dashboards aus
- **Audit-Trail**: Alle Änderungen werden protokolliert
- **Theme Support**: Light/Dark Mode mit System-Präferenz-Erkennung

### Design Tokens
- **Modernes Design**: Luftiges Design mit Gradients und modernen UI-Elementen
- **Konsistente Farben**: Primärfarben, Badge-Farben, Chart-Farben
- **Card-Backgrounds**: bg-white/90, dark:bg-gray-900/80
- **Border-Radius**: rounded-2xl für moderne Optik
- **Standard-Padding**: Konsistente Abstände für Cards, Filterleisten, Tabellen

## Linting/ESLint

- Das Projekt verwendet ESLint mit TypeScript-, React-, Next.js- und Prettier-Support.
- `.eslintrc.js` enthält die zentrale Konfiguration.
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

## Juli 2024: Delta-Updates, Monitoring & Prometheus
- SSE (Server-Sent-Events) für Messwerte, Wetter, Health, Logs, KPIs: Frontend lädt Daten automatisch bei neuen Events nach.
- Admin-Monitoring-Panel: Live-Status-Badges (OK/Warnung/Alarm) und Mini-Linecharts für Importdauer, API-Latenz, Fehlerzähler.
- Prometheus-Metriken: Importdauer, API-Latenz, Fehlerzähler, DB-Größe als /api/metrics (prom-client).
- Fehlerbehebung SSE: ReferenceError bei stream.cancel behoben, robustes Cleanup.
- Optionale Architektur: WebSocket-Upgrade, Prometheus-Alerting, gezielte Delta-Updates, automatisierte Tests, weitere Visualisierungen. 

## Backend/Frontend-Optimierungen & Lessons Learned (2025-07)

- SQLite-Performance-Pragmas (`cache_size`, `temp_store`, `synchronous`) bringen spürbare Performance bei großen Datenmengen, WAL bleibt Standard.
- Prometheus-Metriken für RAM/CPU helfen bei der Früherkennung von Memory-Leaks und Bottlenecks.
- Memory-Leak-Prävention: Cleanup-Hooks für CSV-Watcher und SSE-Subscriber sind Pflicht für lange laufende Prozesse.
- Wetter-API: Fehlerfallbehandlung und konsistente Rückgabe (auch bei leerer DB) sind essenziell für robuste Frontends.
- Frontend: Memoization für große Tabellen und Charts, react-window als Option für virtuelles Scrolling, Ladeindikatoren und Fehlerbehandlung verbessert.
- Lessons Learned: 
  - API-Objekte immer konsistent zurückgeben (nie null/undefined oder Fehlerobjekte ohne Felder).
  - Cleanup bei SIGINT/SIGTERM verhindert Zombie-Handles und Memory-Leaks.
  - Monitoring (Prometheus) frühzeitig einbauen, um Ressourcenprobleme zu erkennen. 

# 2024-07-25

- Multi-Line-Support für GenericChart: Alle übergebenen lines werden als eigene Datasets gerendert (nicht mehr nur las).
- Fehlerursache für leere Charts: lines-Prop muss zu den Daten passen, sonst wird kein Chart angezeigt.
- Testchart für Debugging empfohlen.
- SQLite- und Node-Optimierungen: WAL, cache_size, temp_store, Prometheus-Metriken, Health-API.
- Memory-Leak-Prävention: Cleanup für CSV-Watcher, SSE, Event-Listener, In-Memory-Listen. 

Juni 2024: Memory-Leak-Fixes
- EventSource-Singleton in allen Hooks (useStationData, useWeatherData, useHealth)
- SIGINT/SIGTERM-Listener-Singleton in csv-watcher und api/updates
- Keine MaxListenersExceededWarning mehr, Hot-Reload stabil 