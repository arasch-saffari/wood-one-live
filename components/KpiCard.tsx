import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/LoadingSpinner"
import { ReactNode } from "react"
import React from "react"

interface KpiCardProps {
  icon: ReactNode
  value: ReactNode
  unit?: string
  label: string
  color: string
  children?: ReactNode
  loading?: boolean
}

export function KpiCard({ icon, value, unit, label, color, children, loading }: KpiCardProps) {
  return (
    <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl min-h-[7rem]">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSpinner text="Lädt..." />
        ) : (
          <>
            <div className="flex items-center space-x-2">
              {icon}
              <span className={`text-lg lg:text-2xl font-bold ${color}`}>{value}</span>
              {unit && <span className="text-xs lg:text-sm text-gray-500">{unit}</span>}
            </div>
            {children}
          </>
        )}
      </CardContent>
    </Card>
  )
} 