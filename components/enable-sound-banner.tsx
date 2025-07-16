"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

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