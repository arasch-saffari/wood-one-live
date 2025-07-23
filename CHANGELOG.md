# Changelog

## [Unreleased]
- Weitere Testfälle und End-to-End-Tests geplant
- Performance-Optimierungen für große Datenmengen
- Erweiterte Export-Funktionen

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