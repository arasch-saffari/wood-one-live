import React from "react"
import { LoadingSpinner } from "@/components/LoadingSpinner"
import { Progress } from "@/components/ui/progress"

interface GlobalLoaderProps {
  title?: string
  text?: string
  progress?: number
  icon?: React.ReactNode
}

export function GlobalLoader({ 
  title = "Wood One Audio", 
  text = "Dashboard wird geladen ...", 
  progress,
  icon 
}: GlobalLoaderProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-purple-700 to-pink-600 p-5 shadow-2xl border border-violet-300 dark:border-violet-900">
          {icon}
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-violet-700 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent tracking-tight drop-shadow-lg text-center">
          {title}
        </h1>
      </div>
      <div className="w-full max-w-xs px-6">
        <LoadingSpinner text={text} />
        {progress !== undefined && <Progress value={progress} className="mt-4" />}
      </div>
    </div>
  )
} 