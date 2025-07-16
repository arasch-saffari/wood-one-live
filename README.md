# 🎵 Noise Monitoring Dashboard

Ein modernes, real-time Lärmüberwachungs-Dashboard für Festivals und Veranstaltungen mit Wetterkorrelation und Push-Benachrichtigungen.

## ✨ Features

### 📊 **Echtzeit-Monitoring**
- **Live-Daten**: Kontinuierliche Lärmpegel-Überwachung von mehreren Stationen
- **Wetterkorrelation**: Windgeschwindigkeit und -richtung in Echtzeit
- **Grenzwert-Alarme**: Automatische Benachrichtigungen bei Überschreitungen
- **Responsive Design**: Optimiert für Desktop und Mobile

### 🚨 **Intelligente Alarme**
- **Push-Benachrichtigungen**: Sofortige Alarme bei Grenzwertüberschreitungen
- **Sound-Alerts**: Akustische Warnungen mit Browser-Audio
- **Mehrstufige Warnungen**: 55 dB (Warnung) und 60 dB (Alarm)
- **Anti-Spam**: Intelligente Drosselung von Benachrichtigungen

### 📈 **Datenvisualisierung**
- **Interaktive Charts**: Recharts-basierte Diagramme mit Wind-Overlay
- **Zeitintervalle**: 24h und 7-Tage-Ansichten
- **Station-spezifisch**: Individuelle Dashboards für jeden Standort
- **Export-Funktion**: CSV-Export für Datenanalyse

### 🌤️ **Wetterintegration**
- **Live-Wetterdaten**: Automatische Aktualisierung alle 10 Minuten
- **Windkorrelation**: Einfluss von Windrichtung auf Lärmpegel
- **Luftfeuchtigkeit**: Zusätzliche Umweltparameter
- **Caching-System**: Effiziente Datenverwaltung

## 🏗️ Technologie-Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Charts**: Recharts
- **Datenbank**: SQLite mit better-sqlite3
- **Wetter-API**: Weisserstein.info Integration
- **Benachrichtigungen**: Browser Notifications API

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
│   │   └── band/          # Band-Bühne
│   └── api/               # API-Routen
│       ├── weather/       # Wetter-API
│       └── [station]/     # Stations-spezifische APIs
├── components/
│   ├── ui/               # UI-Komponenten
│   └── notification-permission.tsx
├── hooks/
│   └── useStationData.ts # Daten-Hook
├── lib/
│   ├── db.ts            # Datenbank-Funktionen
│   ├── weather.ts       # Wetter-Integration
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
- **Alle Standorte**: Übersicht aller Stationen
- **Einzelne Stationen**: Detaillierte Ansichten pro Standort
- **Daten Export**: CSV-Export für Analyse
- **Tabelle**: Tabellarische Datenansicht

### Benachrichtigungen aktivieren
1. Auf das Bell-Icon klicken
2. Browser-Berechtigung erteilen
3. Test-Benachrichtigung bestätigen

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
- Sound-Aktivierung über Bell-Icon

### CSV-Daten werden nicht geladen
- Dateipfad und -format prüfen
- Spaltennamen validieren (LAS vs LAF)
- Dateiberechtigungen kontrollieren

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

---

**Entwickelt für das Wood-One Live Festival** 🎵
