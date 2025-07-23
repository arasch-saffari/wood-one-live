"use client";
import React, { createContext, useContext, useEffect, useState } from "react"

type ConfigType = Record<string, unknown> | null

interface ConfigContextType {
  config: ConfigType
  loading: boolean
  error: string | null
  saving: boolean
  saveError: string | null
  success: boolean
  saveConfig: (newConfig: ConfigType) => Promise<void>
  setConfig: React.Dispatch<React.SetStateAction<ConfigType>>
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined)

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ConfigType>(null)
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
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Fehler beim Laden der Konfiguration'))
      .finally(() => setLoading(false))
  }, [])

  async function saveConfig(newConfig: ConfigType) {
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
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const value: ConfigContextType = { config, loading, error, saving, saveError, success, saveConfig, setConfig }
  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used within a ConfigProvider')
  return ctx
} 