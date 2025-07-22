import { ReactNode } from "react"

interface StationHeaderProps {
  icon: ReactNode
  name: string
  color: string
  gradient: string
  statusBadge: ReactNode
  subtitle?: string
}

export function StationHeader({ icon, name, color, gradient, statusBadge, subtitle }: StationHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-3 lg:space-y-0">
      <div className="flex items-center space-x-3">
        <div className={`w-8 lg:w-10 h-8 lg:h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center`}>
          {icon}
        </div>
        <div>
          <h1 className={`text-xl lg:text-2xl font-bold text-${color}-600 dark:text-white`}>{name}</h1>
          {subtitle && <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        {statusBadge}
      </div>
    </div>
  )
} 