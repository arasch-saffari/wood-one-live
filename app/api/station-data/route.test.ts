import { describe, it, expect } from 'vitest'
import { GET } from './route'

function makeMockRequest(url: string) {
  return {
    url,
    headers: {
      get: (key: string) => undefined,
    },
  } as unknown as Request
}

describe('/api/station-data', () => {
  it('gibt 400 zurück, wenn station fehlt', async () => {
    const req = makeMockRequest('http://localhost/api/station-data')
    const res = await GET(req)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/Missing station/)
  })

  it('liefert Daten bei Erfolg', async () => {
    const req = makeMockRequest('http://localhost/api/station-data?station=ort')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
    if (json.data.length > 0) {
      expect(json.data[0]).toHaveProperty('date')
      expect(json.data[0]).toHaveProperty('time')
      expect(json.data[0]).toHaveProperty('maxSPLAFast')
    }
  })
}) 