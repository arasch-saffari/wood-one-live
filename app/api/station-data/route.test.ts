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

  it('liefert Daten und totalCount bei Erfolg', async () => {
    const req = makeMockRequest('http://localhost/api/station-data?station=ort')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(json).toHaveProperty('totalCount')
    expect(Array.isArray(json.data)).toBe(true)
    expect(typeof json.totalCount).toBe('number')
  })

  it('liefert paginierte Daten', async () => {
    const req = makeMockRequest('http://localhost/api/station-data?station=ort&page=1&pageSize=1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeLessThanOrEqual(1)
    expect(typeof json.totalCount).toBe('number')
  })
}) 