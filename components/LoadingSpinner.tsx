import React from 'react'

export function LoadingSpinner({ text = "Lädt...", className = "" }: { text?: string, className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-6 ${className}`}>
      <div className="w-16 h-2 rounded-full bg-gradient-to-r from-blue-200 via-violet-200 to-pink-200 dark:from-blue-900 dark:via-violet-900 dark:to-pink-900 relative overflow-hidden">
        <div className="absolute left-0 top-0 h-full w-1/2 bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500 animate-glow" />
      </div>
      <span className="text-gray-500 text-sm">{text}</span>
    </div>
  )
} 