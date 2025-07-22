"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, BarChart3 } from "lucide-react"
import { useStationData } from "@/hooks/useStationData"
import { DataTable } from "@/components/DataTable"
import { ErrorMessage } from "@/components/ErrorMessage"
import { LoadingSpinner } from "@/components/LoadingSpinner"
import { useConfig } from "@/hooks/useConfig"

export default function AllTablePage() {
  const [interval, setInterval] = useState<"24h" | "7d">("24h")
  const [page, setPage] = useState(1)
  const { config } = useConfig()
  const PAGE_SIZE = config?.pageSize || 20
  // Für jede Station aktuelle Seite laden
  const { data: ortRows, totalCount: ortCount } = useStationData("ort", interval, 60000)
  const { data: technoRows, totalCount: technoCount } = useStationData("techno", interval, 60000)
  const { data: bandRows, totalCount: bandCount } = useStationData("band", interval, 60000)
  const { data: heuballernRows, totalCount: heuballernCount } = useStationData("heuballern", interval, 60000)

  const stations = [
    { id: "ort", name: "Ort", color: "text-emerald-400" },
    { id: "techno", name: "Techno Floor", color: "text-pink-400" },
    { id: "band", name: "Band Bühne", color: "text-purple-400" },
    { id: "heuballern", name: "Heuballern", color: "text-cyan-400" },
  ]

  // Kombiniere alle Daten in eine Liste
  const allRows = [
    ...ortRows.map(row => ({ ...row, station: "Ort" })),
    ...technoRows.map(row => ({ ...row, station: "Techno Floor" })),
    ...bandRows.map(row => ({ ...row, station: "Band Bühne" })),
    ...heuballernRows.map(row => ({ ...row, station: "Heuballern" })),
  ]
  // Sortiere nach Zeit absteigend (neueste oben)
  allRows.sort((a, b) => b.time.localeCompare(a.time))

  // Gesamtanzahl für Pagination (Summe aller Stationen)
  const totalCount = ortCount + technoCount + bandCount + heuballernCount
  const pageCount = Math.ceil(totalCount / PAGE_SIZE)

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

  const columns = [
    { label: "Station", key: "station" },
    { label: "Zeit", key: "time" },
    { label: "Lärmpegel (dB)", key: "las", render: (row: any) => row.las.toFixed(1) },
    { label: "Wind (km/h)", key: "ws", render: (row: any) => row.ws ?? "-" },
    { label: "Richtung", key: "wd", render: (row: any) => row.wd ?? "-" },
    { label: "Feuchtigkeit (%)", key: "rh", render: (row: any) => row.rh ?? "-" },
  ]
  const statusFn = undefined // No status column for all-table
  const filter = null // No extra filter UI for now
  const loading = false
  const error = null

  return (
    <div className="space-y-6">
      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}
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
            <DataTable
              data={allRows}
              columns={columns}
              statusFn={statusFn}
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              filter={filter}
              loading={loading}
            />
          </div>
        </CardContent>
      </Card>
      {pageCount > 1 && (
        <div className="flex justify-center mt-4">
          <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Zurück</button>
          <span className="mx-2">Seite {page} von {pageCount}</span>
          <button disabled={page === pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>Weiter</button>
        </div>
      )}
    </div>
  )
} 