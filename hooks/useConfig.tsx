"use client";
import React, { createContext, useContext, useEffect, useState } from "react"

const ConfigContext = createContext<any>(null)

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/admin/config')
      .then(res => res.json())
      .then(setConfig)
      .catch(e => setError(e.message || 'Fehler beim Laden der Konfiguration'))
      .finally(() => setLoading(false))
  }, [])

  async function saveConfig(newConfig: any) {
    setSaving(true)
    setSaveError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      })
      if (!res.ok) throw new Error('Fehler beim Speichern')
      setConfig(newConfig)
      setSuccess(true)
    } catch (e: any) {
      setSaveError(e.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const value = { config, loading, error, saving, saveError, success, saveConfig, setConfig }
  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
} 