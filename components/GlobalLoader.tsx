import React, { useEffect, useState } from 'react'
// import { Progress } from "@/components/ui/progress" // entfernt, da nicht mehr genutzt

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
  // Simulierter Fortschritt, falls kein echter progress-Prop übergeben wird
  const [internalProgress, setInternalProgress] = useState(0)
  const [timeout, setTimeoutReached] = useState(false)
  useEffect(() => {
    if (progress !== undefined) return
    let val = 0
    const interval = setInterval(() => {
      // Schneller Start, dann langsamer
      val = val < 80 ? val + Math.random() * 8 : val + Math.random() * 2
      if (val > 98) val = 98
      setInternalProgress(val)
    }, 120)
    return () => clearInterval(interval)
  }, [progress])
  useEffect(() => {
    const t = setTimeout(() => setTimeoutReached(true), 15000)
    return () => clearTimeout(t)
  }, [])
  const displayProgress = progress !== undefined ? progress : internalProgress
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-purple-700 to-pink-600 p-5 shadow-2xl border border-violet-300 dark:border-violet-900 animate-pulse">
          {icon}
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-violet-700 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent tracking-tight drop-shadow-lg text-center">
          {title}
        </h1>
      </div>
      <div className="w-full max-w-xs px-6 flex flex-col gap-6">
        <div className="flex flex-col gap-2 items-center">
          <div className="w-full h-4 rounded-xl bg-gradient-to-r from-blue-200 via-violet-200 to-pink-200 dark:from-blue-900 dark:via-violet-900 dark:to-pink-900 relative overflow-hidden shadow-inner">
            <div
              className="absolute left-0 top-0 h-full rounded-xl bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500 animate-glow"
              style={{ width: `${displayProgress}%`, transition: 'width 0.3s cubic-bezier(.4,1,.7,1)' }}
            />
            <div className="absolute left-0 top-0 h-full w-full bg-white/10 dark:bg-black/10 animate-pulse" />
          </div>
          <span className="text-xs text-gray-500 mt-1">{text}</span>
        </div>
        {/* Skeleton-Elemente als Platzhalter */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="h-5 w-40 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-300 dark:from-gray-800 dark:via-gray-700 dark:to-gray-900 animate-pulse" />
          <div className="h-5 w-28 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-300 dark:from-gray-800 dark:via-gray-700 dark:to-gray-900 animate-pulse" />
        </div>
        {timeout && (
          <div className="mt-6 text-center text-red-600 font-semibold">
            Daten konnten nicht geladen werden. Bitte Seite neu laden oder sp 4ter versuchen.<br />
            <button className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600" onClick={() => window.location.reload()}>Neu laden</button>
          </div>
        )}
      </div>
    </div>
  )
} 