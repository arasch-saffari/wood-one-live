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

## 🧪 Tests & Qualitätssicherung

- **Automatisierte Tests**: Das Projekt enthält Unit-Tests, API-Tests und UI-Komponententests (Vitest, Testing Library).
- **Testabdeckung**: Kritische Logik (CSV-Parsing, Wetterdaten, Schwellenwerte), API-Fehlerfälle und zentrale UI-Komponenten werden getestet.
- **Testausführung**:
  ```bash
  pnpm test
  ```
- **Teststrategie**:
  - Unit-Tests für Hilfsfunktionen und Parsing
  - API-Tests für Next.js-Handler (z.B. /api/station-data)
  - UI-Tests für Formulare, Validierung und Interaktion (Testing Library)
- **Mocking**: Externe APIs und Browser-APIs (z.B. matchMedia) werden für Tests gemockt.
- **CI-ready**: Tests laufen headless und können in CI/CD integriert werden.

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

## Tooltips für KPI-Werte und Charts

- Alle wichtigen Werte und Interaktionspunkte in den Dashboards sind mit Tooltips versehen (shadcn/ui).
- Tooltips werden mit TooltipProvider, Tooltip, TooltipTrigger, TooltipContent aus @/components/ui/tooltip implementiert.
- Best Practice: TooltipTrigger immer mit asChild verwenden.
- Tooltips sind barrierefrei und funktionieren mit Tastatur und Screenreader.

## 🛠️ Zentrale Konfiguration

Viele globale Einstellungen wie Chart-Limit, Pagination-Größe, Standard-Intervall, Granularität und Chart-Farben können jetzt direkt im Admin-Panel unter "Einstellungen" angepasst werden. Änderungen wirken sich sofort auf das gesamte Dashboard aus.

- Chart-Limit: Maximale Datenpunkte pro Diagramm
- Pagination: Anzahl Zeilen pro Seite in Tabellen
- Standard-Intervall & Granularität: Voreinstellungen für Diagramme
- Erlaubte Intervalle & Granularitäten: Auswahlmöglichkeiten für Nutzer
- Chart-Farben: Branding und Farbschema für alle Diagramme

Die Konfiguration ist unter `/admin` im Tab "Einstellungen" erreichbar.

## ⚙️ Admin & Settings

- Die Schwellenwerte (Grenzwerte/Zeitblöcke pro Station) werden jetzt **in der Datenbank** gespeichert (Tabelle `thresholds`).
- Änderungen im Admin-Bereich sind sofort persistent und gelten systemweit.
- Die Datei `config.json` enthält keine Schwellenwerte mehr, sondern nur noch andere globale Einstellungen.
- Beim ersten Start werden alte Schwellenwerte aus der bisherigen `config.json` automatisch in die Datenbank übernommen (Migration).

## 🧹 Code-Qualität & Linting

Dieses Projekt verwendet [ESLint](https://eslint.org/) mit einer modernen Konfiguration für Next.js, TypeScript, React und Prettier.

- **Konfiguration:** Siehe `.eslintrc.js` im Projektroot
- **Empfohlene Regeln:**
  - TypeScript, React, Next.js und Prettier werden unterstützt
  - Strikte, aber praxistaugliche Regeln (`no-explicit-any`, `no-unused-vars`, `react-hooks/exhaustive-deps`, Prettier-Formatierung)
  - Prettier ist als ESLint-Plugin integriert
- **Linting ausführen:**
  ```bash
  pnpm lint
  # oder automatisch fixen:
  pnpm lint --fix
  ```
- **Best Practices:**
  - Keine `any`-Typen verwenden (Warnung)
  - Unbenutzte Variablen/Importe entfernen
  - React-Hooks nur im Top-Level verwenden
  - Code-Formatierung immer mit Prettier/ESLint sicherstellen

Linting ist in CI/CD und im lokalen Workflow empfohlen, um Codequalität und Konsistenz zu gewährleisten.

## 🚀 Deployment: Logs & Datenbereinigung

Vor jedem Deployment solltest du alte Log-Dateien entfernen, damit im Admin-Bereich nur aktuelle System-Logs angezeigt werden und keine historischen Einträge aus der lokalen Entwicklung.

**Logs löschen:**
```sh
pnpm tsx scripts/clear-logs.ts
```

- Das Script entfernt alle *.log-Dateien im `logs/`-Verzeichnis.
- Führe es vor jedem Deployment oder Server-Neustart aus, um einen sauberen Zustand zu gewährleisten.
- Optional kannst du auch die Datenbank und Backups zurücksetzen, wenn du komplett neu starten möchtest (siehe Admin-Bereich: Factory Reset).

# 15min-Aggregation für Dashboards

Die 15min-Aggregation wird nicht mehr live in der API berechnet, sondern regelmäßig als materialisierte Tabelle aktualisiert.

- Das Skript `scripts/update-15min-agg.ts` aggregiert alle Messwerte der letzten 7 Tage in 15min-Buckets.
- Es sollte alle 5 Minuten per System-Cronjob ausgeführt werden, z.B.:

```sh
*/5 * * * * cd /Users/araschsaffari/code/cursor/wood-one-live && pnpm tsx scripts/update-15min-agg.ts >> logs/agg.log 2>&1
```

- Du kannst das Skript auch manuell ausführen:

```sh
pnpm tsx scripts/update-15min-agg.ts
```

- Die Dashboards und Unterseiten lesen die 15min-Werte direkt aus der Aggregationstabelle und sind dadurch extrem performant.
