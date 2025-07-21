# Projekt-Notizen: Noise Monitoring Dashboard

## Projektstruktur

- **app/**
  - **dashboard/**: Einzelne Dashboards für jede Messstation (all, ort, heuballern, techno, band, export)
  - **api/**: API-Endpunkte (station-data, weather, process-csv, etc.)
  - **globals.css**: Globale Styles
- **components/**: UI-Komponenten (inkl. shadcn/ui)
- **hooks/**: Custom React Hooks (z.B. useStationData)
- **lib/**: Utilities, Datenbank, CSV- und Wetterintegration
- **public/csv/**: CSV-Daten für jede Station
- **styles/**: Globale Styles
- **README.md, DOCUMENTATION.md**: Projektbeschreibung und technische Dokumentation

## Zentrale Komponenten & Datenflüsse

- **CSV-Datenfluss:**
  1. CSV-Dateien werden in `public/csv/[station]/` abgelegt
  2. CSV-Watcher erkennt neue Dateien (lib/csv-watcher.ts)pn
  3. Daten werden in SQLite-DB importiert (lib/db.ts)
  4. API-Endpunkte liefern Daten an das Frontend (app/api/)
  5. Frontend (app/dashboard/) visualisiert Daten in Charts (Recharts)

- **Wetterdaten:**
  - Bisher: Weisserstein.info (soll auf Open-Meteo API umgestellt werden)
  - Integration über lib/weather.ts und API-Route app/api/weather/

- **Benachrichtigungen:**
  - Browser-Push-Notifications bei Grenzwertüberschreitungen (Warnung/Alarm)
  - Toast-Komponente für UI-Benachrichtigung

- **PWA:**
  - Installierbar, offlinefähig, Add-to-Home-Screen

## Offene Fragen / Unklarheiten

- Gibt es noch Altlasten aus der PHP-Wetterintegration?
- Wie ist die genaue Logik für die Chart-Granularität (aktuell 1, 5, 10 Minuten – 15 Minuten gewünscht)?
- Wie werden Push-Notifications technisch ausgelöst (Service Worker vorhanden?)
- Gibt es ein globales Stations-Array für die Sidebar/Sortierung?

## Aufwandsschätzung (grob)

| Bereich                | Aufwand (Stunden) |
|------------------------|-------------------|
| Chart: 15min + Mobile  | 2–3               |
| Heuballern sortieren   | 0.5               |
| Listenansicht alle     | 1–2               |
| Wetter: Open-Meteo     | 1                 |
| Push-Notifications     | 2–4               |
| PWA-Integration        | 1                 |
| **Gesamt**             | **7–11**          |

## ToDo (siehe Aufgabenliste)

- [ ] Charts: 15min-Granularität, Standard 15min, Mobile-Optimierung
- [ ] Heuballern als letzten Eintrag (Sidebar & Dashboard)
- [ ] Listenansicht aller Stationen
- [ ] Wetter: Open-Meteo API, PHP entfernen
- [ ] Push-Notifications Desktop/Mobile, Toast
- [ ] PWA: Add-to-Home-Screen 

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