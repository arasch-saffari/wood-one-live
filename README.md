# Wood-One Live

## Datenimport-Workflow (ab 2025)

- **Datenquelle:** Nur noch TXT-Dateien im Verzeichnis `public/txt/[station]/`
- **Import:** Ein Node-basiertes Skript (`scripts/txt-watcher.ts`) überwacht und importiert neue/aktualisierte TXT-Dateien automatisch in die Datenbank.
- **Kein CSV-Import mehr!**

### TXT-Watcher lokal starten

```sh
pnpm exec ts-node --transpile-only scripts/txt-watcher.ts
```

> Hinweis: Für produktive Umgebungen sollte der TXT-Watcher als separater Node-Prozess laufen (z.B. via pm2 oder systemd).

## Admin-Features

- **Health-Check:** Systemstatus, Integritätsprüfung und TXT-Watcher-Status im Admin-UI.
- **Notifications:** Alle Fehler und Systemereignisse werden als konsistente Toasts im UI angezeigt.
- **Backup:** Automatisches tägliches Backup der Datenbank (`backups/`).
- **Fehlerhandling:** State-of-the-Art Error-Handling, konsistente UX, keine Altlasten.

## Datenmodell

- **Messwerte:**
  - `station` (string)
  - `date` (string, z.B. `2025-07-22`)
  - `time` (string, z.B. `10:55:29`)
  - `maxSPLAFast` (number)
- **Wetterdaten:**
  - Siehe Tabelle `weather` in der Datenbank

## Entwicklung & Tests

- **API- und Datenlogik-Tests:** Mit Vitest (`pnpm test`)
- **Performance:** Serverseitige Pagination, effiziente Queries, keine Altlasten
- **Monitoring:** Logs im Verzeichnis `logs/` (optional: Integration mit externen Tools möglich)

## Developer Experience

- **TXT-Watcher lokal starten:**
  ```sh
  pnpm exec ts-node --transpile-only scripts/txt-watcher.ts
  ```
- **Health-Checks:** Automatisch im Admin-UI, periodisch alle 30 Sekunden, mit Notification bei Problemen.
- **Admin-Tools:** TXT-Watcher manuell triggern, Logs einsehen, Datenbank-Integrität prüfen – alles im System-Tab des Admin-UI.
- **Logs:** Siehe Verzeichnis `logs/` für System- und Fehler-Logs.
- **Monitoring:** Optional Integration mit externen Tools (Sentry, LogRocket, etc.) möglich.

---

Für weitere Details siehe die Dokumentation im Code und im Admin-UI.
