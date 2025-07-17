# 🎵 Noise Monitoring Dashboard

Ein modernes, real-time Lärmüberwachungs-Dashboard für Festivals und Veranstaltungen mit Wetterkorrelation, intelligenten Tooltips und automatischer Datenverarbeitung.

## ✨ Features

### 📊 **Echtzeit-Monitoring**
- **Live-Daten**: Kontinuierliche Lärmpegel-Überwachung von mehreren Stationen
- **Wetterkorrelation**: Windgeschwindigkeit und -richtung in Echtzeit
- **Grenzwert-Alarme**: Automatische Benachrichtigungen bei Überschreitungen
- **Responsive Design**: Optimiert für Desktop und Mobile
- **PWA-Unterstützung**: "Add to Home Screen" für mobile Nutzung

### 🚨 **Intelligente Alarme & Benachrichtigungen**
- **Push-Benachrichtigungen**: Sofortige Alarme bei Grenzwertüberschreitungen
- **Mehrstufige Warnungen**: 55 dB (Warnung) und 60 dB (Alarm)
- **Anti-Spam**: Intelligente Drosselung von Benachrichtigungen
- **Browser-Permissions**: Sichere Berechtigungsanfragen

### 📈 **Datenvisualisierung & UX**
- **Interaktive Charts**: Recharts-basierte Diagramme mit Wind-Overlay
- **Zeitintervalle**: 24h und 7-Tage-Ansichten
- **Station-spezifisch**: Individuelle Dashboards für jeden Standort
- **Intelligente Tooltips**: Kontextuelle Hilfe und Erklärungen
- **Konsistente KPI-Karten**: Standardisierte Darstellung aller Stationen
- **Export-Funktion**: CSV-Export für Datenanalyse

### 🌤️ **Wetterintegration**
- **Live-Wetterdaten**: Automatische Aktualisierung alle 10 Minuten
- **Windkorrelation**: Einfluss von Windrichtung auf Lärmpegel
- **Luftfeuchtigkeit**: Zusätzliche Umweltparameter
- **Caching-System**: Effiziente Datenverwaltung

### 🔄 **Automatische Datenverarbeitung**
- **CSV-Watcher**: Automatische Erkennung neuer CSV-Dateien
- **Datenbank-Integration**: Sofortige Verarbeitung und Speicherung
- **Duplikat-Erkennung**: Verhindert doppelte Verarbeitung
- **Performance-Optimierung**: Schnelle Datenbankabfragen

## 🏗️ Technologie-Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Charts**: Recharts
- **Datenbank**: SQLite mit better-sqlite3
- **Wetter-API**: Weisserstein.info Integration
- **Benachrichtigungen**: Browser Notifications API
- **PWA**: Service Worker & Manifest

## 🚀 Installation

### Voraussetzungen
- Node.js 18+ 
- pnpm (empfohlen) oder npm
- SQLite3

### Setup
```bash
# Repository klonen
git clone <repository-url>
cd noise-monitoring-dashboard

# Dependencies installieren
pnpm install

# Entwicklungsserver starten
pnpm dev
```

### Umgebungsvariablen
```env
# Optional: Datenbank-Pfad anpassen
DATABASE_PATH=./data.sqlite
```

## 📁 Projektstruktur

```
├── app/
│   ├── dashboard/          # Dashboard-Seiten
│   │   ├── all/           # Übersicht aller Stationen
│   │   ├── ort/           # Standort Ort
│   │   ├── techno/        # Techno Floor
│   │   ├── heuballern/    # Heuballern
│   │   ├── band/          # Band-Bühne
│   │   ├── export/        # Daten-Export
│   │   └── admin/         # Admin-Dashboard
│   └── api/               # API-Routen
│       ├── weather/       # Wetter-API
│       ├── station-data/  # Stations-Daten
│       ├── process-csv/   # CSV-Verarbeitung
│       └── csv-watcher-status/ # Watcher-Status
├── components/
│   ├── ui/               # UI-Komponenten
│   └── theme-provider.tsx
├── hooks/
│   └── useStationData.ts # Daten-Hook
├── lib/
│   ├── db.ts            # Datenbank-Funktionen
│   ├── weather.ts       # Wetter-Integration
│   ├── csv-watcher.ts   # CSV-Watcher
│   └── utils.ts         # Hilfsfunktionen
└── public/
    └── csv/             # CSV-Daten der Stationen
```

## 📊 Datenformate

### CSV-Struktur
```csv
Messnummer;Datum;Systemzeit ;LAS;LS;Effektiver Schalldruck;...
1;25.06.2024;23:20:55:741;49,8;64,3;0,03298097;...
```

### Wetterdaten
```json
{
  "windSpeed": 12.5,
  "windDir": "SW",
  "relHumidity": 65.2
}
```

## 🔧 Konfiguration

### Stationen hinzufügen
1. CSV-Dateien in `public/csv/[station-name]/` ablegen
2. Station in `hooks/useStationData.ts` konfigurieren
3. Dashboard-Seite erstellen

### Grenzwerte anpassen
```typescript
// In hooks/useStationData.ts
const WARNING_THRESHOLD = 55  // dB
const ALARM_THRESHOLD = 60    // dB
```

### Wetter-Update-Intervall
```typescript
// In lib/db.ts
const WEATHER_UPDATE_INTERVAL = 10 // Minuten
```

## 📱 Verwendung

### Dashboard-Navigation
- **Alle Standorte**: Übersicht aller Stationen mit Klick-Navigation
- **Einzelne Stationen**: Detaillierte Ansichten pro Standort
- **Daten Export**: CSV-Export für Analyse
- **Tabelle**: Tabellarische Datenansicht mit Filterung
- **Admin**: CSV-Watcher Status und manuelle Verarbeitung

### Benachrichtigungen aktivieren
1. Browser-Berechtigung für Notifications erteilen
2. Automatische Alarme bei Grenzwertüberschreitungen
3. Keine Sound-Benachrichtigungen (entfernt für bessere UX)

### PWA-Features
- **Mobile Installation**: "Add to Home Screen" Button
- **Offline-Funktionalität**: Service Worker für Caching
- **Native App-Feeling**: Vollbild-Modus und Splash Screen

### Intelligente Tooltips
- **KPI-Karten**: Erklärungen zu Messwerten und Trends
- **Status-Badges**: Kontextuelle Informationen zu Alarmstufen
- **Buttons**: Nutzungshinweise für alle Aktionen
- **Charts**: Datenpunkte und Grenzwerte erklärt

### Daten-Export
1. Zur Export-Seite navigieren
2. Station und Zeitraum wählen
3. CSV-Datei herunterladen

## 🔍 Troubleshooting

### Wetterdaten werden nicht aktualisiert
- Prüfen Sie die Internetverbindung
- Wetter-API-Status kontrollieren
- Datenbank-Cache leeren

### Benachrichtigungen funktionieren nicht
- Browser-Berechtigungen prüfen
- HTTPS erforderlich für Notifications
- Browser-Kompatibilität testen

### CSV-Daten werden nicht geladen
- Dateipfad und -format prüfen
- Spaltennamen validieren (LAS vs LAF)
- Dateiberechtigungen kontrollieren
- CSV-Watcher Status im Admin-Bereich prüfen

### PWA-Installation funktioniert nicht
- HTTPS erforderlich für PWA-Features
- Browser-Kompatibilität prüfen
- Service Worker Status kontrollieren

## 🎯 Neue Features (v2.0)

### ✨ **Intelligente Tooltips**
- Kontextuelle Hilfe auf allen UI-Elementen
- Dynamische Daten-Erklärungen
- Accessibility-Verbesserungen

### 📱 **PWA-Integration**
- Mobile "Add to Home Screen" Funktionalität
- Service Worker für Offline-Caching
- Native App-Erfahrung

### 🔄 **Automatische CSV-Verarbeitung**
- CSV-Watcher für neue Dateien
- Automatische Datenbank-Integration
- Admin-Dashboard für Status-Monitoring

### 🎨 **UI-Verbesserungen**
- Konsistente KPI-Karten über alle Stationen
- Standardisierte Status-Badges
- Verbesserte Responsive-Darstellung

## 🤝 Beitragen

1. Fork erstellen
2. Feature-Branch erstellen (`git checkout -b feature/amazing-feature`)
3. Änderungen committen (`git commit -m 'Add amazing feature'`)
4. Branch pushen (`git push origin feature/amazing-feature`)
5. Pull Request erstellen

## 📄 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert.

## 🙏 Danksagungen

- **Wetterdaten**: Weisserstein.info
- **UI-Komponenten**: shadcn/ui
- **Charts**: Recharts
- **Animationen**: Framer Motion
- **PWA-Tools**: Next.js PWA Support

---

**Entwickelt für das Wood-One Live Festival** 🎵

**Version 2.0** - Mit intelligenten Tooltips, PWA-Support und automatischer Datenverarbeitung
