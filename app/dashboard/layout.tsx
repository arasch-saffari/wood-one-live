"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Speaker, Home, BarChart3, MapPin, Users, Settings, X, Menu, Sun, Moon, Plus, Wifi, WifiOff, Download, Volume2, Music } from 'lucide-react'
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useStationData } from "@/hooks/useStationData"
import { STATION_COLORS } from "@/lib/colors"
// import { NotificationPermission } from "@/components/notification-permission"
// import { EnableSoundBanner } from "@/components/enable-sound-banner"

// Navigation Menü Konfiguration
const navigation = [
  { name: "Alle Standorte", href: "/dashboard/all", icon: Home, color: STATION_COLORS.all.menuColor },
  { name: "Ort", href: "/dashboard/ort", icon: MapPin, color: STATION_COLORS.ort.menuColor },
  { name: "Heuballern", href: "/dashboard/heuballern", icon: MapPin, color: STATION_COLORS.heuballern.menuColor },
  { name: "Techno Floor", href: "/dashboard/techno", icon: Volume2, color: STATION_COLORS.techno.menuColor },
  { name: "Band Bühne", href: "/dashboard/band", icon: Music, color: STATION_COLORS.band.menuColor },
  { name: "Daten Export", href: "/dashboard/export", icon: Download, color: STATION_COLORS.export.menuColor },
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Mobile Menu Overlay - Nur auf kleinen Bildschirmen sichtbar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Hintergrund Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setMobileMenuOpen(false)} 
          />
          {/* Mobile Sidebar mit eleganter Animation */}
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-y-0 left-0 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl"
          >
            <div className="flex h-full flex-col">
              {/* Mobile Logo Header */}
              <div className="flex h-24 items-center justify-between px-8">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <Speaker className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-lg font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                    Wood-One Live
                  </span>
                </div>
                {/* Schließen Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Mobile Navigation Menu */}
              <nav className="flex-1 px-8 py-10 space-y-4">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link key={item.name} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                      <motion.div
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={cn(
                          "flex items-center px-5 py-4 rounded-2xl text-sm font-medium transition-all duration-200 group",
                          isActive
                            ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25"
                            : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white",
                        )}
                      >
                        <item.icon className={cn("w-5 h-5 mr-4 transition-transform group-hover:scale-110", isActive ? "text-white" : item.color)} />
                        <span className="font-medium">{item.name}</span>
                      </motion.div>
                    </Link>
                  )
                })}
              </nav>

              {/* Mobile System Status */}
              <div className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-700 mx-6 mb-6 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">System Status</span>
                  <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 font-medium">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />
                    Online
                  </Badge>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Letzte Aktualisierung: vor 2 Min</div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Desktop Sidebar - Nur auf großen Bildschirmen sichtbar */}
      <motion.div
        initial={{ x: -300, opacity: 0 }}
        animate={{ 
          x: sidebarOpen ? 0 : -250, 
          opacity: sidebarOpen ? 1 : 0.95,
          width: sidebarOpen ? 280 : 80
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="fixed inset-y-0 left-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl shadow-slate-900/10 dark:shadow-black/20 hidden lg:block"
      >
        <div className="flex h-full flex-col">
          {/* Desktop Logo */}
          <div className="flex h-24 items-center px-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Speaker className="w-5 h-5 text-white" />
              </div>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  <span className="text-lg font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                    Wood-One Live
                  </span>
                </motion.div>
              )}
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="flex-1 px-6 py-10 space-y-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link key={item.name} href={item.href}>
                  <motion.div
                    whileHover={{ scale: 1.02, x: sidebarOpen ? 4 : 0 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={cn(
                      "flex items-center rounded-2xl text-sm font-medium transition-all duration-200 group relative",
                      sidebarOpen ? "px-5 py-4" : "px-4 py-4 justify-center",
                      isActive
                        ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25"
                        : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white",
                    )}
                  >
                    <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", 
                      sidebarOpen ? "mr-4" : "",
                      isActive ? "text-white" : item.color
                    )} />
                    {sidebarOpen && (
                      <motion.span 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2, delay: 0.05 }}
                        className="font-medium"
                      >
                        {item.name}
                      </motion.span>
                    )}
                    {!sidebarOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ opacity: 1, scale: 1 }}
                        className="absolute left-full ml-4 px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium rounded-lg shadow-lg pointer-events-none z-50"
                      >
                        {item.name}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-slate-900 dark:bg-white rotate-45" />
                      </motion.div>
                    )}
                  </motion.div>
                </Link>
              )
            })}
          </nav>

          {/* Desktop System Status */}
          {sidebarOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-700 mx-4 mb-6 rounded-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">System Status</span>
                <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 font-medium">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />
                  Online
                </Badge>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Letzte Aktualisierung: {formatTime(latestTime)} ({getRelativeTime(latestTime)})
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Hauptinhalt Container */}
      <div className={cn("transition-all duration-300 ease-out", sidebarOpen ? "lg:ml-[280px]" : "lg:ml-20")}>
        {/* Header Bar */}
        <header className="h-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl shadow-sm shadow-slate-900/5 dark:shadow-black/10 flex items-center justify-between px-6 lg:px-8">
          <div className="flex items-center space-x-6">
            {/* Desktop Sidebar Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-3 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50 rounded-xl hidden lg:flex transition-all duration-200"
            >
              <Menu className="w-5 h-5" />
            </Button>
            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(true)}
              className="p-3 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50 rounded-xl lg:hidden transition-all duration-200"
            >
              <Menu className="w-5 h-5" />
            </Button>
            {/* Titel und Beschreibung */}
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Festival Live Monitoring
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium hidden sm:block">
                Echtzeit Lärm- & Wetterüberwachung
              </p>
            </div>
          </div>

          {/* Header Aktionen */}
          <div className="flex items-center space-x-3">
            {/* Dark/Light Mode Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-3 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50 rounded-xl transition-all duration-200"
            >
              {mounted && theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            {/* Add to Home Screen - Mobile Only */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if ('serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window) {
                  // Trigger the install prompt
                  const event = new Event('beforeinstallprompt')
                  window.dispatchEvent(event)
                } else {
                  // Fallback: Show instructions
                  alert('Um diese App zum Startbildschirm hinzuzufügen:\n\n1. Tippen Sie auf das Teilen-Symbol\n2. Wählen Sie "Zum Startbildschirm hinzufügen"\n3. Bestätigen Sie die Installation')
                }
              }}
              className="p-3 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50 rounded-xl lg:hidden transition-all duration-200"
            >
              <Download className="w-5 h-5" />
            </Button>
          </div>
        </header>
        {/* Seiteninhalt */}
        <main className="p-6 lg:p-8 min-h-[calc(100vh-5rem)]">{children}</main>
        
        {/* Footer */}
        <footer className="bg-gradient-to-r from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-slate-800 backdrop-blur-sm">
          <div className="px-6 lg:px-8 py-6">
            <div className="flex items-center justify-center text-sm text-slate-600 dark:text-slate-400 font-medium">
              <span className="bg-gradient-to-r from-slate-600 to-slate-500 dark:from-slate-400 dark:to-slate-300 bg-clip-text text-transparent">
                © 2025 by Arasch Saffari. Made with ❤️ and Club Mate
              </span>
            </div>
          </div>
        </footer>
      </div>
      {/* <NotificationPermission /> */}
      {/* <EnableSoundBanner /> */}
    </div>
  )
}
