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
}) 