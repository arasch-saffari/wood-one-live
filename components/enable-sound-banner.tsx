"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// Typdefinition für BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function EnableSoundBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Only show if AudioContext is present
    if (typeof window !== 'undefined' && window.AudioContext) {
      setVisible(true)
    }
    const handleClick = () => setVisible(false)
    window.addEventListener('click', handleClick, { once: true })
    return () => window.removeEventListener('click', handleClick)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 px-6 py-3 rounded-xl shadow-lg flex items-center space-x-3 border border-yellow-300 dark:border-yellow-700"
        >
          <AlertTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-300" />
          <span className="text-sm font-medium">Bitte einmal auf die Seite klicken, damit der Sound-Alarm funktioniert.</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function EnablePwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Prüfe, ob Android (und nicht iOS oder Desktop)
    const isAndroid = typeof window !== 'undefined' && /android/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone: boolean }).standalone
    const alreadyShown = window.localStorage.getItem('pwaBannerShown') === 'true'
    if (!isAndroid || isStandalone || alreadyShown) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowBanner(true)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  // Banner nur einmalig anzeigen
  useEffect(() => {
    if (showBanner) {
      window.localStorage.setItem('pwaBannerShown', 'true')
    }
  }, [showBanner])

  if (!showBanner) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-6 py-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-8">
      <span className="font-medium text-sm text-gray-900 dark:text-white">App zum Startbildschirm hinzufügen?</span>
      <button
        className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-lg font-semibold text-xs shadow hover:scale-105 transition"
        onClick={async () => {
          if (deferredPrompt) {
            (deferredPrompt as BeforeInstallPromptEvent).prompt()
            const userChoice = await (deferredPrompt as BeforeInstallPromptEvent).userChoice
            const { outcome } = userChoice
            if (outcome === "accepted") {
              setShowBanner(false)
            }
          }
        }}
      >
        Hinzufügen
      </button>
      <button
        className="ml-2 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white"
        onClick={() => setShowBanner(false)}
      >
        Schließen
      </button>
    </div>
  )
} 