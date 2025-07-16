"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { BarChart3, Home, MapPin, Wind, Moon, Sun, Bell, Volume2, Music, Download, Menu, X } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useStationData } from "@/hooks/useStationData"
import { NotificationPermission } from "@/components/notification-permission"
// import { EnableSoundBanner } from "@/components/enable-sound-banner"

// Navigation Menü Konfiguration
const navigation = [
  { name: "Alle Standorte", href: "/dashboard/all", icon: Home, color: "text-gray-400" },
  { name: "Ort", href: "/dashboard/ort", icon: MapPin, color: "text-emerald-400" },
  { name: "Heuballern", href: "/dashboard/heuballern", icon: MapPin, color: "text-cyan-400" },
  { name: "Techno Floor", href: "/dashboard/techno", icon: Volume2, color: "text-pink-400" },
  { name: "Band Bühne", href: "/dashboard/band", icon: Music, color: "text-purple-400" },
  { name: "Daten Export", href: "/dashboard/export", icon: Download, color: "text-gray-400" },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // State Management für Sidebar und Mobile Menu
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Letzte Aktualisierung: Hole Daten von allen Stationen und berechne das neueste Datum
  const ortData = useStationData("ort", "24h")
  const heuballernData = useStationData("heuballern", "24h")
  const technoData = useStationData("techno", "24h")
  const bandData = useStationData("band", "24h")
  // Alle Zeitpunkte sammeln
  const allTimes = [
    ...ortData.map(d => d.time),
    ...heuballernData.map(d => d.time),
    ...technoData.map(d => d.time),
    ...bandData.map(d => d.time),
  ].filter(Boolean)
  // Neueste Zeit finden (Format: 'HH:MM' oder 'YYYY-MM-DD HH:MM:SS')
  const latestTime = allTimes.sort().reverse()[0]
  // Hilfsfunktion: Zeitdifferenz in Minuten berechnen
  function getRelativeTime(latest: string | undefined) {
    if (!latest) return "-"
    // Versuche, ein Date-Objekt zu bauen
    let date
    if (latest.length > 5) {
      // Format: 'YYYY-MM-DD HH:MM:SS'
      date = new Date(latest.replace(" ", "T"))
    } else {
      // Format: 'HH:MM'
      const now = new Date()
      const [h, m] = latest.split(":").map(Number)
      date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
    }
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "vor wenigen Sekunden"
    if (diffMin === 1) return "vor 1 Min"
    return `vor ${diffMin} Min`
  }
  // Hilfsfunktion: Uhrzeit formatieren
  function formatTime(latest: string | undefined) {
    if (!latest) return "-"
    if (latest.length > 5) {
      // Format: 'YYYY-MM-DD HH:MM:SS'
      return latest.split(" ")[1] + " Uhr"
    }
    return latest + ":00 Uhr"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-black dark:to-gray-800">
      {/* Mobile Menu Overlay - Nur auf kleinen Bildschirmen sichtbar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Hintergrund Overlay */}
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          {/* Mobile Sidebar mit schnellerer Animation */}
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ duration: 0.2, ease: "easeOut" }} // Schnellere Animation
            className="fixed inset-y-0 left-0 w-64 bg-white/95 dark:bg-black/90 backdrop-blur-xl border-r border-gray-200 dark:border-gray-700"
          >
            <div className="flex h-full flex-col">
              {/* Mobile Logo Header */}
              <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Wind className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                    Wood-One Live
                  </span>
                </div>
                {/* Schließen Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Mobile Navigation Menu */}
              <nav className="flex-1 px-4 py-6 space-y-2">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link key={item.name} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.1 }} // Schnellere Hover Animation
                        className={cn(
                          "flex items-center px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150", // Schnellere Transition
                          isActive
                            ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg"
                            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white",
                        )}
                      >
                        <item.icon className={cn("w-5 h-5 mr-3", isActive ? "text-white" : item.color)} />
                        {item.name}
                      </motion.div>
                    </Link>
                  )
                })}
              </nav>

              {/* Mobile System Status */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">System Status</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full mr-1" />
                    Online
                  </Badge>
                </div>
                <div className="text-xs text-gray-500">Letzte Aktualisierung: vor 2 Min</div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Desktop Sidebar - Nur auf großen Bildschirmen sichtbar */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: sidebarOpen ? 0 : -250 }}
        transition={{ duration: 0.2, ease: "easeOut" }} // Schnellere Animation
        className="fixed inset-y-0 left-0 z-40 w-64 bg-white/95 dark:bg-black/90 backdrop-blur-xl border-r border-gray-200 dark:border-gray-700 hidden lg:block"
      >
        <div className="flex h-full flex-col">
          {/* Desktop Logo */}
          <div className="flex h-16 items-center px-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Wind className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                Wood-One Live
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link key={item.name} href={item.href}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.1 }} // Schnellere Hover Animation
                    className={cn(
                      "flex items-center px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150", // Schnellere Transition
                      isActive
                        ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white",
                    )}
                  >
                    <item.icon className={cn("w-5 h-5 mr-3", isActive ? "text-white" : item.color)} />
                    {item.name}
                  </motion.div>
                </Link>
              )
            })}
          </nav>

          {/* Desktop System Status */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">System Status</span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <div className="w-2 h-2 bg-emerald-400 rounded-full mr-1" />
                Online
              </Badge>
            </div>
            <div className="text-xs text-gray-500">Letzte Aktualisierung: {formatTime(latestTime)} ({getRelativeTime(latestTime)})</div>
          </div>
        </div>
      </motion.div>

      {/* Hauptinhalt Container */}
      <div className={cn("transition-all duration-200", sidebarOpen ? "lg:ml-64" : "lg:ml-14")}>
        {" "}
        {/* Schnellere Transition */}
        {/* Header Bar */}
        <header className="h-16 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center space-x-4">
            {/* Desktop Sidebar Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hidden lg:flex"
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white lg:hidden"
            >
              <Menu className="w-4 h-4" />
            </Button>
            {/* Titel und Beschreibung */}
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Festival Live Monitoring</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                Echtzeit Lärm- & Wetterüberwachung
              </p>
            </div>
          </div>

          {/* Header Aktionen */}
          <div className="flex items-center space-x-2 lg:space-x-3">
            {/* Dark/Light Mode Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              {mounted && theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            {/* Benachrichtigungen */}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                // Sound-Aktivierung: Versuche einen AudioContext zu starten
                let soundEnabled = false
                if (typeof window !== 'undefined' && window.AudioContext) {
                  try {
                    const ctx = new window.AudioContext()
                    if (ctx.state === 'suspended') {
                      await ctx.resume()
                    }
                    // Kurzer Bestätigungston
                    const osc = ctx.createOscillator()
                    const gain = ctx.createGain()
                    osc.connect(gain)
                    gain.connect(ctx.destination)
                    osc.type = 'sine'
                    osc.frequency.value = 880
                    gain.gain.value = 0.1
                    osc.start()
                    osc.stop(ctx.currentTime + 0.15)
                    osc.onended = () => ctx.close()
                    soundEnabled = true
                  } catch (e) {
                    // ignore
                  }
                }
                // Notification-Logik wie gehabt
                if (!('Notification' in window)) {
                  alert('Ihr Browser unterstützt keine Benachrichtigungen.')
                  return
                }
                if (Notification.permission === 'granted') {
                  new Notification('🔔 Test-Benachrichtigung', {
                    body: soundEnabled ? 'Sound-Alarm ist jetzt aktiviert!' : 'Benachrichtigungen sind aktiviert und funktionieren!',
                    icon: '/alert-icon.svg',
                    silent: false
                  })
                } else if (Notification.permission !== 'denied') {
                  const permission = await Notification.requestPermission()
                  if (permission === 'granted') {
                    new Notification('🔔 Benachrichtigungen aktiviert!', {
                      body: soundEnabled ? 'Sound-Alarm ist jetzt aktiviert!' : 'Sie werden jetzt über Lärmalarme informiert.',
                      icon: '/alert-icon.svg',
                      silent: false
                    })
                  }
                } else {
                  alert('Benachrichtigungen wurden verweigert. Bitte aktivieren Sie sie in Ihren Browser-Einstellungen.')
                }
              }}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <Bell className="w-4 h-4" />
            </Button>
            {/* Members Icon entfernt wie gewünscht */}
          </div>
        </header>
        {/* Seiteninhalt */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
      <NotificationPermission />
      {/* <EnableSoundBanner /> */}
    </div>
  )
}
