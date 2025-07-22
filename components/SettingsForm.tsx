import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ReactNode, FormEvent } from "react"

export interface SettingsField {
  name: string
  label: string
  type: "text" | "number" | "password" | "email"
  value: any
  onChange: (value: any) => void
  placeholder?: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}

export interface SettingsFormProps {
  fields: SettingsField[]
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  submitLabel?: string
  error?: string | ReactNode
  loading?: boolean
  children?: ReactNode
}

export function SettingsForm({ fields, onSubmit, submitLabel = "Speichern", error, loading, children }: SettingsFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader />
        <CardContent className="space-y-4">
          {fields.map(field => (
            <div key={field.name} className="flex flex-col gap-1">
              <Label htmlFor={field.name}>{field.label}</Label>
              <Input
                id={field.name}
                type={field.type}
                value={field.value}
                onChange={e => field.onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
                placeholder={field.placeholder}
                min={field.min}
                max={field.max}
                step={field.step}
                disabled={field.disabled}
                className="max-w-xs"
              />
            </div>
          ))}
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