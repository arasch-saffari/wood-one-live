"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, BellOff, AlertTriangle } from "lucide-react"
import { motion } from "framer-motion"

export function NotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [isRequesting, setIsRequesting] = useState(false)

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert('Ihr Browser unterstützt keine Benachrichtigungen.')
      return
    }

    setIsRequesting(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      
      if (result === 'granted') {
        // Test notification
        new Notification('🔔 Benachrichtigungen aktiviert!', {
          body: 'Sie werden jetzt über Lärmalarme informiert.',
          icon: '/alert-icon.png',
          silent: false
        })
      }
    } catch (error) {
      console.error('Fehler beim Anfordern der Benachrichtigungserlaubnis:', error)
    } finally {
      setIsRequesting(false)
    }
  }

  if (permission === 'granted') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <Card className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border-emerald-500/20">
          <CardContent className="py-3">
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="font-medium text-emerald-400 text-sm">Benachrichtigungen aktiviert</p>
                <p className="text-xs text-emerald-400/80">Sie werden über Lärmalarme informiert</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  if (permission === 'denied') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <Card className="bg-gradient-to-r from-red-500/10 to-red-600/10 border-red-500/20">
          <CardContent className="py-3">
            <div className="flex items-center space-x-3">
              <BellOff className="w-5 h-5 text-red-400" />
              <div>
                <p className="font-medium text-red-400 text-sm">Benachrichtigungen deaktiviert</p>
                <p className="text-xs text-red-400/80">Bitte aktivieren Sie Benachrichtigungen in Ihren Browser-Einstellungen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <Card className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border-yellow-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-600 dark:text-yellow-400">Lärmalarme aktivieren</span>
          </CardTitle>
          <CardDescription className="text-xs text-yellow-600/80 dark:text-yellow-400/80">
            Erhalten Sie sofortige Benachrichtigungen bei Grenzwertüberschreitungen
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Button
            onClick={requestPermission}
            disabled={isRequesting}
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white border-0"
            size="sm"
          >
            <Bell className="w-4 h-4 mr-2" />
            {isRequesting ? 'Wird aktiviert...' : 'Benachrichtigungen aktivieren'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
} 