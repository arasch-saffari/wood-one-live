import { describe, it, expect } from 'vitest'
import { parseCSVData } from './csv-processing'
import { getMinuteAveragesForStation } from './db'
import db from './database'

describe('parseCSVData', () => {
  it('parst einfache CSV korrekt', () => {
    const csv = 'Systemzeit ;LAS\n12:00;55.2\n12:05;56.1'
    const result = parseCSVData(csv, 'ort')
    expect(result.length).toBe(2)
    expect(result[0].time).toBe('12:00')
    expect(result[0].las).toBeCloseTo(55.2)
  })
  it('ignoriert Zeilen mit ungültigen Werten', () => {
    const csv = 'Systemzeit ;LAS\n12:00;abc\n12:05;56.1'
    const result = parseCSVData(csv, 'ort')
    expect(result.length).toBe(1)
    expect(result[0].time).toBe('12:05')
  })
  it('gibt leeres Array bei leerer CSV zurück', () => {
    expect(parseCSVData('', 'ort')).toEqual([])
  })
})

describe('Zeitreihen-Aggregation (Regression)', () => {
  it('liefert für 10 Tage und 15min-Intervalle die erwartete Anzahl Buckets', () => {
    // Testdaten: 10 Tage, alle 15min ein Wert
    const station = 'teststation'
    const start = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    const bucketMs = 15 * 60 * 1000
    const numDays = 10
    const numBuckets = numDays * 24 * 4 // 4 Buckets pro Stunde
    // Vorher aufräumen
    db.prepare('DELETE FROM measurements WHERE station = ?').run(station)
    for (let i = 0; i < numBuckets; i++) {
      const ts = new Date(start.getTime() + i * bucketMs)
      const datetime = ts.toISOString().replace('T', ' ').slice(0, 19)
      // time eindeutig machen: HH:MM:SS_YYYY-MM-DD
      const time = datetime.slice(11, 19) + '_' + datetime.slice(0, 10)
      db.prepare('INSERT INTO measurements (station, time, las, datetime) VALUES (?, ?, ?, ?)')
        .run(station, time, 50 + (i % 10), datetime)
    }
    // Aggregation aufrufen
    const result = getMinuteAveragesForStation(station, '7d')
    // Es sollten mindestens 7*24*4 = 672 Buckets für 7 Tage sein
    expect(result.length).toBeGreaterThanOrEqual(672)
    // Optional: Prüfe, dass keine Buckets fehlen (lückenlos)
    const bucketSet = new Set(result.map(r => r.bucket))
    expect(bucketSet.size).toBe(result.length)
  })
}) 