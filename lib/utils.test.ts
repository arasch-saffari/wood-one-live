import { describe, it, expect } from 'vitest'
import * as utils from './utils'

describe('roundTo5MinBlock', () => {
  it('rundet Minuten korrekt ab', () => {
    expect(utils.roundTo5MinBlock('12:07')).toBe('12:05')
    expect(utils.roundTo5MinBlock('09:02')).toBe('09:00')
    expect(utils.roundTo5MinBlock('23:59')).toBe('23:55')
  })
  it('gibt Zeit unverändert zurück, wenn Format falsch', () => {
    expect(utils.roundTo5MinBlock('12')).toBe('12')
    expect(utils.roundTo5MinBlock('')).toBe('')
  })
}) 