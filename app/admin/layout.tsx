"use client"
import type { ReactNode } from "react"
import { Geist, Geist_Mono } from "next/font/google"
import "../globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { SystemBanner } from '@/components/ui/system-banner'

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <SystemBanner />
        {children}
        <Toaster />
      </ThemeProvider>
    </div>
  )
} 