"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, BarChart3 } from "lucide-react"
import { useStationData } from "@/hooks/useStationData"

export default function AllTablePage() {
  const [interval, setInterval] = useState<"24h" | "7d">("24h")
  const ortData = useStationData("ort", interval)
  const technoData = useStationData("techno", interval)
  const bandData = useStationData("band", interval)
  const heuballernData = useStationData("heuballern", interval)

  const stations = [
    { id: "ort", name: "Ort", color: "text-emerald-400" },
    { id: "techno", name: "Techno Floor", color: "text-pink-400" },
    { id: "band", name: "Band Bühne", color: "text-purple-400" },
    { id: "heuballern", name: "Heuballern", color: "text-cyan-400" },
  ]

  // Kombiniere alle Daten in eine Liste
  const allRows = [
    ...ortData.map(row => ({ ...row, station: "Ort" })),
    ...technoData.map(row => ({ ...row, station: "Techno Floor" })),
    ...bandData.map(row => ({ ...row, station: "Band Bühne" })),
    ...heuballernData.map(row => ({ ...row, station: "Heuballern" })),
  ]
  // Sortiere nach Zeit absteigend (neueste oben)
  allRows.sort((a, b) => b.time.localeCompare(a.time))

  const exportData = () => {
    const csvContent = [
      "Station,Zeit,Lärmpegel (dB),Windgeschwindigkeit (km/h),Windrichtung,Luftfeuchtigkeit (%)",
      ...allRows.map((row) => 
        `${row.station},${row.time},${row.las},${row.ws || "N/A"},${row.wd || "N/A"},${row.rh || "N/A"}`
      )
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `all_data.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alle Messwerte – Listenansicht</h1>
          <p className="text-gray-600 dark:text-gray-400">Kombinierte Tabelle aller Stationen ({stations.map(s => s.name).join(", ")})</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={interval} onChange={e => (setInterval(e.target.value as "24h" | "7d"))} className="border rounded px-2 py-1 text-sm">
            <option value="24h">Letzte 24h</option>
            <option value="7d">Letzte 7 Tage</option>
          </select>
          <Button onClick={exportData} className="bg-gradient-to-r from-pink-500 to-purple-600">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span>Alle Messwerte</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Station</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Zeit</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Lärmpegel (dB)</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Wind (km/h)</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Richtung</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Feuchtigkeit (%)</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-3 px-4 font-semibold">
                      {row.station}
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{row.time}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{row.las.toFixed(1)}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{row.ws ?? "-"}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{row.wd ?? "-"}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{row.rh ?? "-"}</td>
                  </tr>
                ))}
                {allRows.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-gray-400">Keine Daten gefunden.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 