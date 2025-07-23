"use client"
import React, { useState } from "react";
import type { ReactNode } from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Lock } from "lucide-react"
import "../globals.css"

const ADMIN_USER = "sebi";
const ADMIN_PASS = "acab1312";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      setAuthed(true);
      setError("");
    } else {
      setError("Falscher Benutzername oder Passwort");
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-200 dark:from-slate-900 dark:to-blue-950">
        <Card className="w-full max-w-sm shadow-2xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/80 rounded-2xl">
          <CardHeader className="flex flex-col items-center gap-2 pb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-2">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Admin Login</h2>
            <Badge className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2 py-1 rounded mt-1">Zugvoegel Admin</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-2 pb-6">
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <Input
                className="h-11 rounded-lg border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-400 text-base bg-white/80 dark:bg-gray-900/70"
                placeholder="Benutzername"
                value={user}
                onChange={e => setUser(e.target.value)}
                autoFocus
                autoComplete="username"
              />
              <Input
                className="h-11 rounded-lg border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-400 text-base bg-white/80 dark:bg-gray-900/70"
                placeholder="Passwort"
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                autoComplete="current-password"
              />
              {error && <div className="text-red-500 text-sm text-center -mt-2">{error}</div>}
              <Button type="submit" className="w-full h-11 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold text-base shadow-md hover:from-blue-600 hover:to-purple-700 transition">Login</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
} 