# Noise Monitoring Dashboard

Ein modernes, responsives Dashboard für die Überwachung von Lärmpegeln und Wetterdaten an verschiedenen Standorten.

## 🚀 Features

- **Echtzeit-Monitoring**: Live-Daten von allen Messstationen
- **Flexible Chart-Intervalle**: 
  - Zeiträume: 7 Tage, 24unden
  - Granularität:10Minuten-Mittelwert, 5-Minuten-Mittelwert, 1-Minuten-Wert
- **Automatische CSV-Verarbeitung**: Neue CSV-Dateien werden automatisch erkannt und verarbeitet
- **Wetter-Integration**: Windgeschwindigkeit, Windrichtung und Luftfeuchtigkeit
- **Browser-Benachrichtigungen**: Push-Notifications bei Lärmüberschreitungen
- **PWA-Support**: Installierbar als mobile App
- **Responsive Design**: Optimiert für Desktop und Mobile
- **Dark/Light Mode**: Automatische Anpassung an Systemeinstellungen

## 📊 Stationen

- **Ort**: Allgemeine Lärmmessung
- **Heuballern**: Spezielle Messstation
- **Techno Floor**: Event-Bereich
- **Band Bühne**: Musikveranstaltungen

## 🛠️ Installation

git cogit ```bash
# Dependencies installieren
pnpm install

# Entwicklungsserver starten
pnpm dev

# Build für Produktion
pnpm build
```

## 📁 Projektstruktur

```
├── app/
│   ├── dashboard/          # Dashboard-Seiten
│   │   ├── all/           # Gesamtübersicht
│   │   ├── ort/           # Ort-Station
│   │   ├── heuballern/    # Heuballern-Station
│   │   ├── techno/        # Techno Floor
│   │   ├── band/          # Band Bühne
│   │   └── export/        # Datenexport
│   ├── api/               # API-Endpunkte
│   └── globals.css        # Globale Styles
├── components/            # UI-Komponenten
├── hooks/                # Custom Hooks
├── lib/                  # Utilities & Database
└── public/csv/           # CSV-Daten
```

## 🔧 Konfiguration

### CSV-Daten

Legen Sie CSV-Dateien in `public/csv/[station]/` ab:
- `public/csv/ort/`
- `public/csv/heuballern/`
- `public/csv/techno/`
- `public/csv/band/`

### Datenformat

CSV-Dateien sollten folgendes Format haben:
```csv
Systemzeit;LAS;LAF;...
12:00;450.2;47.1;...
12:15;4618.3.
```

## 📈 Chart-Funktionen

### Intervall-Auswahl
- **7 Tage**: Zeigt Daten der letzten 7 Tage
- **24den**: Zeigt Daten der letzten 24 Stunden

### Granularität
- **10-Minuten-Mittelwert**: Durchschnitt über 10inuten-Blöcke
- **5-Minuten-Mittelwert**: Durchschnitt über 5-Minuten-Blöcke  
- **1-Minuten-Wert**: Einzelwerte pro Minute

### Datenbegrenzung
Alle Charts zeigen maximal 50enpunkte für optimale Performance.

## 🔔 Benachrichtigungen

Das Dashboard unterstützt Browser-Benachrichtigungen:
- Automatische Anfrage bei erstem Besuch
- Warnungen bei Lärmüberschreitungen (≥55)
- Alarm bei kritischen Werten (≥60 dB)

## 📱 PWA-Features

- Installierbar auf mobilen Geräten
- Offline-Funktionalität
- App-ähnliche Erfahrung

## 🎨 Design

- **Responsive**: Optimiert für alle Bildschirmgrößen
- **Dark/Light Mode**: Automatische Anpassung
- **Moderne UI**: Clean Design mit Tailwind CSS
- **Smooth Animations**: Framer Motion Integration

## 🚀 Deployment

```bash
# Produktions-Build
pnpm build

# Starten
pnpm start
```

## Hinweis zu Wetterdaten (ab [heutiges Datum])
- Es werden keine Fallback- oder Defaultwerte für Wetterdaten mehr verwendet.
- Wenn keine echten Wetterdaten vorliegen, gibt die API für alle Felder null und ein 'noWeatherData: true'-Flag zurück.
- Das Frontend zeigt dann 'keine Wetterdaten verfügbar' an und verwendet keine Platzhalterwerte mehr in Statistiken oder Charts.

## 📝 Lizenz

MIT License - siehe LICENSE-Datei für Details.

---

**Entwickelt mit ❤️ für die Lärmüberwachung**
