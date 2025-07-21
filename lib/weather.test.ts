import { describe, it, expect, vi, afterEach } from 'vitest'
import * as weather from './weather'

// Mock fetch
const originalFetch = global.fetch

describe('fetchWeather', () => {
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('liefert Wetterdaten bei Erfolg', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          windspeed_10m: 12,
          winddirection_10m: 180,
          relativehumidity_2m: 55,
          temperature_2m: 21
        }
      })
    })
    const result = await weather.fetchWeather()
    expect(result).toEqual({
      windSpeed: 12,
      windDir: '180°',
      relHumidity: 55,
      temperature: 21
    })
  })

  it('wirft Fehler nach 3 Fehlversuchen', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Netzwerkfehler'))
    await expect(weather.fetchWeather()).rejects.toThrow('Failed to fetch weather after 3 attempts')
  })

  it('wirft Fehler bei HTTP-Fehler', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' })
    await expect(weather.fetchWeather()).rejects.toThrow('Failed to fetch weather after 3 attempts')
  })
}) 