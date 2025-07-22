import { describe, it, expect } from 'vitest'
import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:3001'

describe('Admin Panel API', () => {
  it('should reset the database (factory reset)', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/factory-reset`, { method: 'POST' })
    const contentType = res.headers.get('content-type')
    const text = await res.text()
    console.log('Factory Reset Response:', contentType, text)
    expect(res.status).toBe(200)
    if (contentType && contentType.includes('application/json')) {
      const data = JSON.parse(text)
      expect(data.success).toBe(true)
    } else {
      throw new Error('Response is not JSON!')
    }
  }, 20000)

  it('should rebuild the database', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/rebuild-db`, { method: 'POST' })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should update config', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pollingIntervalSeconds: 180 })
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should download a backup', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/backup-db`)
    expect(res.status).toBe(200)
    const buffer = await res.arrayBuffer()
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('should return health status', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/health`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toHaveProperty('dbSize')
    expect(data).toHaveProperty('diskFree')
    expect(data).toHaveProperty('integrityProblem')
  })
}) 