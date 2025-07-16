"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, BarChart3 } from "lucide-react"
import { useStationData } from "@/hooks/useStationData"

export default function AllTablePage() {
  const [selectedStation, setSelectedStation] = useState<string>("ort")
  const data = useStationData(selectedStation, "24h")

  const stations = [
    { id: "ort", name: "Ort", color: "text-emerald-400" },
    { id: "techno", name: "Techno Floor", color: "text-pink-400" },
    { id: "heuballern", name: "Heuballern", color: "text-cyan-400" },
    { id: "band", name: "Band", color: "text-purple-400" },
  ]

  const exportData = () => {
    const csvContent = [
      "Zeit,Lärmpegel (dB),Windgeschwindigkeit (km/h),Windrichtung,Luftfeuchtigkeit (%)",
      ...data.map((row) => 
        `${row.time},${row.las},${row.ws || "N/A"},${row.wd || "N/A"},${row.rh || "N/A"}`
      )
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${selectedStation}_data.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daten Tabelle</h1>
          <p className="text-gray-600 dark:text-gray-400">Detaillierte Messwerte aller Stationen</p>
        </div>
        <Button onClick={exportData} className="bg-gradient-to-r from-pink-500 to-purple-600">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stations.map((station) => (
          <Button
            key={station.id}
            variant={selectedStation === station.id ? "default" : "outline"}
            onClick={() => setSelectedStation(station.id)}
            className={selectedStation === station.id ? "bg-gradient-to-r from-pink-500 to-purple-600" : ""}
          >
            <BarChart3 className={`w-4 h-4 mr-2 ${station.color}`} />
            {station.name}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span>Messwerte - {stations.find(s => s.id === selectedStation)?.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Zeit</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Lärmpegel (dB)</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Wind (km/h)</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Richtung</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Feuchtigkeit (%)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{row.time}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{row.las.toFixed(1)}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{row.ws || "N/A"}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{row.wd || "N/A"}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{row.rh || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 