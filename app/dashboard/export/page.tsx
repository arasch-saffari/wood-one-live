"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, Database, Wind, Volume2, MapPin, Music } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const locations = [
  { id: "ort", name: "Ort", icon: MapPin, color: "text-emerald-400" },
  { id: "heuballern", name: "Heuballern", icon: MapPin, color: "text-cyan-400" },
  { id: "techno", name: "Techno Floor", icon: Volume2, color: "text-pink-400" },
  { id: "band", name: "Band Bühne", icon: Music, color: "text-purple-400" },
]

const dataTypes = [
  { id: "noise", name: "Lärmpegel (dB)", icon: Volume2, description: "15-Minuten-Intervall-Messungen" },
  { id: "wind", name: "Winddaten", icon: Wind, description: "Geschwindigkeit, Richtung und Böen" },
  { id: "violations", name: "Grenzwertverletzungen", icon: FileText, description: "Warn- und Alarmereignisse" },
  { id: "aggregated", name: "Stündliche Aggregate", icon: Database, description: "Min, Max, Durchschnittswerte" },
]

async function fetchExportData(station: string, interval: string): Promise<Array<Record<string, string | number | boolean | null | undefined>>> {
  const res = await fetch(`/api/station-data?station=${encodeURIComponent(station)}&interval=${interval}&granularity=15min`)
  if (!res.ok) return []
  return await res.json()
}

export default function ExportPage() {
  const { toast } = useToast()
  const [selectedLocations, setSelectedLocations] = useState<string[]>(["ort"])
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>(["noise", "wind"])
  const [dateRange, setDateRange] = useState("24h")
  const [format, setFormat] = useState("csv")
  const [isExporting, setIsExporting] = useState(false)

  const handleLocationChange = (locationId: string, checked: boolean) => {
    if (checked) {
      setSelectedLocations([...selectedLocations, locationId])
    } else {
      setSelectedLocations(selectedLocations.filter((id) => id !== locationId))
    }
  }

  const handleDataTypeChange = (dataTypeId: string, checked: boolean) => {
    if (checked) {
      setSelectedDataTypes([...selectedDataTypes, dataTypeId])
    } else {
      setSelectedDataTypes(selectedDataTypes.filter((id) => id !== dataTypeId))
    }
  }

  const handleExport = async () => {
    if (selectedLocations.length === 0) {
      toast({
        title: "Keine Standorte ausgewählt",
        description: "Bitte wählen Sie mindestens einen Standort zum Exportieren aus.",
        variant: "destructive",
      })
      return
    }

    if (selectedDataTypes.length === 0) {
      toast({
        title: "Keine Datentypen ausgewählt",
        description: "Bitte wählen Sie mindestens einen Datentyp zum Exportieren aus.",
        variant: "destructive",
      })
      return
    }

    setIsExporting(true)

    // Echte Daten laden
    const allData: Array<Record<string, string | number | boolean | null | undefined>> = []
    for (const locationId of selectedLocations) {
      const stationData: Array<Record<string, string | number | boolean | null | undefined>> = await fetchExportData(locationId, dateRange)
      for (const row of stationData) {
        const exportRow: Record<string, string | number | boolean | null | undefined> = {
          station: locationId,
          time: row.time,
          datetime: row.datetime,
          las: row.las,
          ws: row.ws,
          wd: row.wd,
          rh: row.rh,
          temp: row.temp,
          warningThreshold: row.warningThreshold,
          alarmThreshold: row.alarmThreshold,
          lasThreshold: row.lasThreshold,
          lafThreshold: row.lafThreshold,
        }
        if (selectedDataTypes.includes("violations")) {
          exportRow.warning_threshold_exceeded = (row as Record<string, unknown>).las >= (row as Record<string, unknown>).warningThreshold
          exportRow.alarm_threshold_exceeded = (row as Record<string, unknown>).las >= (row as Record<string, unknown>).alarmThreshold
        }
        allData.push(exportRow)
      }
    }

    if (format === "csv") {
      const headers = Object.keys(allData[0] || {})
      const csvRows = [headers.join(",")]
      
      // Optimiert: Einzelne Schleife statt nested map()
      for (const row of allData) {
        const values = headers.map(header => String(row[header] ?? ""))
        csvRows.push(values.join(","))
      }
      
      const csvContent = csvRows.join("\n")

      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `wood-one-live-export-${dateRange}-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const jsonExportContent = JSON.stringify(allData, null, 2)
      const blob = new Blob([jsonExportContent], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `wood-one-live-export-${dateRange}-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    }

    setIsExporting(false)
    toast({
      title: "Export abgeschlossen",
      description: `Daten für ${selectedLocations.length} Standort(e) mit ${selectedDataTypes.length} Datentyp(en) erfolgreich exportiert.`,
    })
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header Bereich */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between space-y-3 lg:space-y-0"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 lg:w-10 h-8 lg:h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Download className="w-4 lg:w-5 h-4 lg:h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-pink-600 dark:text-white">Daten Export</h1>
            <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">
              Exportieren Sie Lärm- und Wetterdaten von allen Überwachungsstandorten
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        {/* Konfiguration */}
        <div className="xl:col-span-2 space-y-4 lg:space-y-6">
          {/* Standortauswahl */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
                  <MapPin className="w-4 lg:w-5 h-4 lg:h-5 text-pink-400" />
                  <span className="text-pink-600 dark:text-white">Standorte auswählen</span>
                </CardTitle>
                <CardDescription className="text-xs lg:text-sm">
                  Wählen Sie die Überwachungsstandorte aus, die in den Export aufgenommen werden sollen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                  {locations.map((location) => (
                    <div
                      key={location.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30"
                    >
                      <Checkbox
                        id={location.id}
                        checked={selectedLocations.includes(location.id)}
                        onCheckedChange={(checked) => handleLocationChange(location.id, checked as boolean)}
                      />
                      <div className="flex items-center space-x-2 flex-1">
                        <location.icon className={`w-4 h-4 ${location.color}`} />
                        <Label
                          htmlFor={location.id}
                          className="cursor-pointer text-gray-700 dark:text-gray-300 text-sm lg:text-base"
                        >
                          {location.name}
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Datentyp-Auswahl */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
                  <Database className="w-4 lg:w-5 h-4 lg:h-5 text-purple-400" />
                  <span className="text-purple-600 dark:text-white">Datentypen auswählen</span>
                </CardTitle>
                <CardDescription className="text-xs lg:text-sm">
                  Wählen Sie die Datentypen aus, die in den Export aufgenommen werden sollen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 lg:space-y-4">
                  {dataTypes.map((dataType) => (
                    <div
                      key={dataType.id}
                      className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30"
                    >
                      <Checkbox
                        id={dataType.id}
                        checked={selectedDataTypes.includes(dataType.id)}
                        onCheckedChange={(checked) => handleDataTypeChange(dataType.id, checked as boolean)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <dataType.icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          <Label
                            htmlFor={dataType.id}
                            className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 text-sm lg:text-base"
                          >
                            {dataType.name}
                          </Label>
                        </div>
                        <p className="text-xs lg:text-sm text-gray-500 mt-1">{dataType.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Export-Optionen */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-sm lg:text-base">
                  <FileText className="w-4 lg:w-5 h-4 lg:h-5 text-cyan-400" />
                  <span className="text-cyan-600 dark:text-white">Export-Optionen</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dateRange" className="text-gray-700 dark:text-gray-300 text-sm lg:text-base">
                      Zeitbereich
                    </Label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 dark:focus:ring-purple-500 focus:border-transparent dark:focus:border-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg">
                        <SelectItem value="1h">Letzte Stunde</SelectItem>
                        <SelectItem value="6h">Letzte 6 Stunden</SelectItem>
                        <SelectItem value="24h">Letzte 24 Stunden</SelectItem>
                        <SelectItem value="7d">Letzte 7 Tage</SelectItem>
                        <SelectItem value="30d">Letzte 30 Tage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="format" className="text-gray-700 dark:text-gray-300 text-sm lg:text-base">
                      Dateiformat
                    </Label>
                    <Select value={format} onValueChange={setFormat}>
                      <SelectTrigger className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 dark:focus:ring-purple-500 focus:border-transparent dark:focus:border-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg">
                        <SelectItem value="csv">CSV (Komma-getrennt)</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Zusammenfassung & Export */}
        <div className="space-y-4 lg:space-y-6">
          {/* Export-Zusammenfassung */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base lg:text-lg text-purple-600 dark:text-white">
                  Export-Zusammenfassung
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">Standorte</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedLocations.map((locationId) => {
                      const location = locations.find((l) => l.id === locationId)
                      return location ? (
                        <Badge
                          key={locationId}
                          className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 text-xs rounded-full"
                        >
                          {location.name}
                        </Badge>
                      ) : null
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">Datentypen</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedDataTypes.map((dataTypeId) => {
                      const dataType = dataTypes.find((d) => d.id === dataTypeId)
                      return dataType ? (
                        <Badge
                          key={dataTypeId}
                          className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 text-xs rounded-full"
                        >
                          {dataType.name}
                        </Badge>
                      ) : null
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">Zeitbereich</Label>
                  <p className="text-xs lg:text-sm text-gray-700 dark:text-gray-300 mt-1">{dateRange}</p>
                </div>
                <div>
                  <Label className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">Format</Label>
                  <p className="text-xs lg:text-sm text-gray-700 dark:text-gray-300 mt-1">{format.toUpperCase()}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Export Button */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
              <CardContent className="pt-6">
                <Button
                  onClick={handleExport}
                  disabled={isExporting || selectedLocations.length === 0 || selectedDataTypes.length === 0}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-lg focus:ring-2 focus:ring-pink-500 dark:focus:ring-purple-500 focus:border-transparent dark:focus:border-transparent"
                  size="lg"
                >
                  {isExporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Exportiere...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Daten Exportieren
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Geschätzte Dateigröße: ~
                  {Math.max(1, selectedLocations.length * selectedDataTypes.length * 0.5).toFixed(1)} MB
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Letzte Exporte */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <Card className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base lg:text-lg text-pink-600 dark:text-white">Letzte Exporte</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div>
                      <p className="text-xs lg:text-sm font-medium text-gray-700 dark:text-gray-300">
                        Alle Standorte - 24h
                      </p>
                      <p className="text-xs text-gray-500">vor 2 Stunden</p>
                    </div>
                    <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 text-xs rounded-full">
                      CSV
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div>
                      <p className="text-xs lg:text-sm font-medium text-gray-700 dark:text-gray-300">
                        Techno Floor - 7d
                      </p>
                      <p className="text-xs text-gray-500">vor 1 Tag</p>
                    </div>
                    <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 text-xs rounded-full">
                      JSON
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div>
                      <p className="text-xs lg:text-sm font-medium text-gray-700 dark:text-gray-300">Winddaten - 30d</p>
                      <p className="text-xs text-gray-500">vor 3 Tagen</p>
                    </div>
                    <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 text-xs rounded-full">
                      CSV
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
