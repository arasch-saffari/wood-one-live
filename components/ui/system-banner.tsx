"use client"

import React, { useEffect, useState } from 'react'

export function SystemBanner() {
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    async function fetchWarning() {
      try {
        const res = await fetch('/api/admin/monitoring-status')
        if (!res.ok) return
        const data = await res.json()
        if (data.notify) {
          setWarning(data.message || 'Systemintegritätsproblem erkannt!')
        }
      } catch {
        // intentionally ignored
      }
    }
    fetchWarning()
    const interval = setInterval(fetchWarning, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!warning) return null
  return (
    <div className="w-full bg-red-600 text-white p-2 text-center font-semibold flex items-center justify-center z-50">
      <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z" /></svg>
      {warning}
    </div>
  )
} 