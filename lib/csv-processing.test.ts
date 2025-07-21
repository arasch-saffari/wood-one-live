import { describe, it, expect } from 'vitest'
import { parseCSVData } from './csv-processing'

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