import { AlertTriangle } from "lucide-react"
import { ReactNode } from "react"

export function ErrorMessage({ message, className = "" }: { message: string | ReactNode, className?: string }) {
  return (
    <div className={`flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-200 rounded-lg px-4 py-2 text-sm font-medium ${className}`}>
      <AlertTriangle className="w-4 h-4 mr-1 text-red-500" />
      <span>{message}</span>
    </div>
  )
} 