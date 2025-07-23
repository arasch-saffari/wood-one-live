import React from 'react'
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface SettingsField {
  name: string
  label: string
  type: "text" | "number" | "password" | "email" | "select" | "checkbox-group"
  value: unknown
  onChange: (value: unknown) => void
  placeholder?: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  options?: { value: string; label: string }[] // für select und checkbox-group
}

export interface SettingsFormProps {
  fields: SettingsField[]
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  submitLabel?: string
  error?: string | React.ReactNode
  loading?: boolean
  children?: React.ReactNode
}

export function SettingsForm({ fields, onSubmit, submitLabel = "Speichern", error, loading, children }: SettingsFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader />
        <CardContent className="space-y-4">
          {Array.isArray(fields) ? fields.map(field => (
            <div key={field.name} className="flex flex-col gap-1">
              <Label htmlFor={field.name}>{field.label}</Label>
              {field.type === "select" ? (
                <select
                  id={field.name}
                  value={field.value}
                  onChange={e => field.onChange(e.target.value)}
                  disabled={field.disabled}
                  className="max-w-xs border rounded px-2 py-1"
                >
                  {Array.isArray(field.options) ? field.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  )) : null}
                </select>
              ) : field.type === "checkbox-group" ? (
                <div className="flex gap-4 flex-wrap">
                  {Array.isArray(field.options) ? field.options.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Array.isArray(field.value) ? field.value.includes(opt.value) : false}
                        onChange={e => {
                          if (e.target.checked) {
                            field.onChange([...(field.value || []), opt.value])
                          } else {
                            field.onChange((field.value || []).filter((v: string) => v !== opt.value))
                          }
                        }}
                        disabled={field.disabled}
                      />
                      {opt.label}
                    </label>
                  )) : null}
                </div>
              ) : (
                <Input
                  id={field.name}
                  type={field.type}
                  value={String(field.value ?? '')}
                  onChange={e => field.onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
                  placeholder={field.placeholder ? String(field.placeholder) : undefined}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  disabled={field.disabled}
                  className="max-w-xs"
                />
              )}
            </div>
          )) : null}
          {children}
          {error && <div className="text-red-500 text-sm font-medium">{error}</div>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Speichern..." : submitLabel}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
} 