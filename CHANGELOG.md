# Changelog

## [Unreleased] - 2025-01-25

### 🚀 Production-Ready Improvements
- **Enterprise-Grade Error Handling**: Global error middleware with structured API responses
- **Input Validation & Sanitization**: Zod-based validation for all API endpoints with detailed error messages
- **Rate Limiting & DoS Protection**: Intelligent rate limiting with IP-based tracking and configurable limits
- **Structured Logging**: Pino-based JSON logging with performance monitoring and error context
- **Multi-Level Caching**: In-memory caching with fallback implementation and cache-or-compute pattern
- **Time & Timezone Handling**: Luxon-based UTC storage with timezone-aware display and validation
- **Configuration Management**: Environment-based configuration with Zod validation and type safety
- **Database Enhancements**: Connection pooling, health checks, transaction support, and query performance monitoring
- **File Upload Security**: Secure CSV upload with type validation, size limits, and processing pipeline
- **CI/CD Pipeline**: GitHub Actions with multi-Node testing, security audits, and coverage reporting
- **Health Monitoring**: Comprehensive system status endpoint with database, cache, and performance metrics
### Added
- **Performance-Optimierungen**: Umfassende Frontend- und Backend-Optimierungen für bessere Ladezeiten
- **SQL-Level-Pagination**: Alle API-Endpunkte nutzen jetzt LIMIT/OFFSET statt JavaScript-slice()
- **Request-Timeout-Schutz**: 10s Timeout mit AbortController für alle API-Requests
- **React.memo-Optimierungen**: Memoized Components für teure Re-Renders
- **CronOptimizer-Klasse**: Erweiterte Cron-Job-Verwaltung mit Überlappungsschutz und Retry-Mechanismus
- **Serverseitige Tabellensortierung**: Neue API `/api/table-data` für korrekte Sortierung auf Datenbankebene
- **Table-Data-Service**: Umfassender Service für Sortierung, Filterung und Pagination
- **TypeScript-Interfaces**: Vollständige Typisierung aller Dashboard-States und API-Responses

### Fixed
- **Node-Cron "missed execution" Warnungen**: Alle synchronen I/O-Operationen zu asynchronen umgewandelt
- **Frontend-Hänger**: PageSize von 1000+ auf 25-100 Datenpunkte reduziert
- **Dashboard-Layout-Performance**: Von 4×50 auf 4×1 Datenpunkte für "Letzte Aktualisierung"
- **API-Cache-Problem**: 50.000-Zeilen-Cache entfernt, direkte SQL-Pagination implementiert
- **Blocking I/O in Cron-Jobs**: fs.copyFileSync/writeFileSync/readFileSync zu fs.promises.* umgewandelt
- **Datenlücken in Datenbank**: INSERT OR IGNORE zu INSERT OR REPLACE geändert für konsistente Daten
- **Sortierung in AllStationsTable**: Funktioniert jetzt korrekt auf gesamter Datenbank statt nur Frontend-Daten
- **Memory Leaks**: EventSource-Cleanup in StationDashboardPage und anderen Komponenten
- **Error Handling**: Alle leeren catch-Blöcke haben jetzt proper Error-Logging
- **Type Safety**: Alle `any` Types durch spezifische TypeScript-Interfaces ersetzt
- **CSV Export Performance**: Nested map() durch optimierte for-Schleife ersetzt (O(n²) → O(n))
- **Accessibility**: ARIA-Labels für kritische Buttons und UI-Elemente hinzugefügt

### Changed
- **Default PageSize**: Von 50 auf 25 Datenpunkte als Standard in useStationData
- **Polling-Frequenz**: Von 60s auf 300s für Dashboard-Layout-Komponenten
- **Cron-Job-Timeouts**: Alle Cron-Jobs haben jetzt 30-60s Timeout-Schutz
- **API-Response-Format**: Konsistente Rückgabe mit totalPages und besserer Fehlerbehandlung
- **Database Operations**: INSERT OR REPLACE statt INSERT OR IGNORE für bessere Datenkonsistenz
- **Error Messages**: Spezifische Fehlermeldungen statt generische catch-Blöcke

## [Unreleased] - 2024-06-XX
### Fixed
- Memory-Leak bei EventSource-Handling in allen React-Hooks (useStationData, useWeatherData, useHealth) behoben: Singleton-Pattern, Listener-Cleanup, keine doppelten Instanzen mehr.
- SIGINT/SIGTERM-Listener werden jetzt nur noch einmalig pro Prozess registriert (Singleton), keine MaxListenersExceededWarning mehr.
- Hot-Reload und Navigation führen nicht mehr zu Ressourcenlecks oder UI-Hängern.

## [Unreleased] - 2024-07-25
### Added
- Multi-Line-Support für GenericChart: Mehrere Linien pro Chart, dynamische Datasets, Thresholds pro y-Achse.
- Testchart und Debug-Logs für Chart-Diagnose.
- Prometheus-Metriken für RAM, CPU, DB-Größe, Importdauer, API-Latenz, Fehler.
- Health-API und Admin-Monitoring-Panel für Systemressourcen.
### Fixed
- Fehlerursache für leere Charts: lines-Prop und Datenstruktur müssen zusammenpassen.
- Memory-Leak-Prävention: Cleanup für CSV-Watcher, SSE, Event-Listener, In-Memory-Listen.
### Changed
- SQLite- und Node-Optimierungen: WAL, cache_size, temp_store, bessere Ressourcenfreigabe.

## Dezember 2024
- **Neuer Zugvoegel Dashboard**: Einheitliches Dashboard kombiniert Daten von mehreren Stationen
- **Zentrale Konfiguration**: Chart-Limit, Pagination, Intervall, Granularität und Chart-Farben im Admin-Panel
- **Einstellungen-Seite**: Neu gestaltet und übersichtlich an Schwellenwert-Seite angelehnt
- **Design Tokens**: Modernes, luftiges Design mit Gradients, Primärfarben, Badge-Farben, Card-Backgrounds
- **Datenbank-Thresholds**: Alle Schwellenwert-Konfigurationen jetzt in der Datenbank mit Audit-Trail
- **Real-time Updates**: Konfigurationsänderungen wirken sich sofort auf alle Dashboards aus
- **Theme Support**: Light/Dark Mode mit System-Präferenz-Erkennung

## Juli 2024
- **API-Response**: `/api/station-data` liefert jetzt immer `{ data, totalCount }`
- **Pagination**: Über `page` und `pageSize` können gezielt Seiten abgefragt werden
- **Fehlerbenachrichtigung**: Kritische Fehler werden mit `notify: true` im API-Response markiert
- **Health-Check & Monitoring**: Automatischer täglicher Integritäts-Check der Datenbank
- **System-Banner**: Integritätsprobleme werden prominent im Admin-UI angezeigt
- **Teststrategie**: API-Tests prüfen jetzt auch Pagination und das neue Response-Format

## Juli 2024 – Delta-Updates, Monitoring & Prometheus
- **Delta-Update-Architektur:** Server-Sent-Events (SSE) für alle Kernbereiche (Messwerte, Wetter, Health, Logs, KPIs). Frontend lädt Daten automatisch bei neuen Events nach.
- **Admin Monitoring Panel:** Live-Status-Badges (OK/Warnung/Alarm) und Mini-Linecharts für Importdauer, API-Latenz, Fehlerzähler. Übersichtliche Prometheus-Metriken im Admin-Dashboard.
- **Prometheus-Integration:** Export von Importdauer, API-Latenz, Fehlerzähler, DB-Größe als /api/metrics (prom-client).
- **Fehlerbehebung SSE:** Initialisierungsfehler im SSE-Stream (ReferenceError bei stream.cancel) behoben, robustes Cleanup implementiert.
- **Optionale Architektur:** WebSocket-Upgrade, Prometheus-Alerting, gezielte Delta-Updates, automatisierte Tests und weitere Visualisierungen vorbereitet.

## Juni 2024
- **Automatisierte Tests**: Einführung von Vitest, Testing Library
- **Test-Abdeckung**: Unit-Tests für Parsing, Wetter, Schwellenwerte; API-Tests für Fehlerfälle; UI-Tests für Validierung
- **Mocking**: Wetter-API und Browser-APIs (matchMedia) werden gemockt
- **Fehlerquellen**: Aliase, React, jsdom, Request-Mocks gelöst
- **Teststrategie**: Qualitätskonzept dokumentiert und implementiert

## Mai 2024
- **Open-Meteo Integration**: Vollständige Umstellung auf Open-Meteo API
- **Wetterdaten-Handling**: Keine Fallback-Werte mehr, nur echte Daten
- **CSV-Watcher**: Läuft jetzt auch im Build/Production-Modus
- **Zeitzonen-Fix**: Wetterdaten werden korrekt in Europe/Berlin angezeigt
- **Konfiguration**: csvAutoProcess und enableNotifications wirken systemweit

## April 2024
- **PWA-Features**: Add-to-Home-Screen, Offline-Funktionalität
- **Push-Notifications**: Desktop/Mobile-Benachrichtigungen bei Grenzwertüberschreitungen
- **Toast-System**: UI-Benachrichtigungen mit shadcn/ui
- **Responsive Design**: Mobile-Optimierung für alle Dashboards
- **Chart-Optimierung**: 15min-Granularität, Standard-Intervall-Anpassungen

## März 2024
- **Admin-Panel**: Vollständige Verwaltungsoberfläche
- **Datenkorrektur**: Editieren und Löschen von Messwerten/Wetterdaten
- **Backup-System**: Automatische Datenbank-Backups
- **Integritäts-Checks**: Tägliche Überprüfung der Datenbank
- **Logging-System**: Zentrales Logging mit Fehlerklassen

## Februar 2024
- **CSV-Integration**: Automatische Verarbeitung von CSV-Dateien
- **Datenbank-Migration**: SQLite-Integration mit WAL-Modus
- **API-Endpunkte**: Station-Daten und Wetter-APIs
- **Chart-System**: Recharts-basierte Visualisierung
- **Grundlegende UI**: shadcn/ui Komponenten-System 