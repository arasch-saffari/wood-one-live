# Noise Monitoring Dashboard – Dokumentation

## Datenmodell

- Messwerte: { station: string, date: string, time: string, maxSPLAFast: number }
- Wetterdaten: { station: string, time: string, windSpeed: number, windDir: string, relHumidity: number, temperature: number, created_at: string }

## API Reference

### Station Data API
- `GET /api/station-data?station={station}`
- Returns `{ data: Array<{ station, date, time, maxSPLAFast }> }`

### Weather API
- `GET /api/weather?station={station}&time={time}`
- Returns `{ windSpeed, windDir, relHumidity, temperature, noWeatherData }`

## Hinweise
- Es gibt keine CSV- oder Altlogik mehr im System.
- Alle Charts und Tabellen arbeiten ausschließlich mit {station, date, time, maxSPLAFast}.
- Wetterdaten werden weiterhin unterstützt und angezeigt.

## Glossar
- **maxSPLAFast**: Maximaler Schallpegel (A-bewertet, Fast)
- **Wetterdaten**: Windgeschwindigkeit, Windrichtung, Luftfeuchtigkeit, Temperatur

## Weitere Abschnitte
- ... (weitere Dokumentationsinhalte nach Bedarf) 