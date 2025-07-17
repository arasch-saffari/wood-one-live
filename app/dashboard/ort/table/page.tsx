"use client"

import { useState, useMemo } from "react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "@/components/ui/pagination"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useStationData } from "@/hooks/useStationData"

const PAGE_SIZE = 20

function getStatus(level: number, isNight = false) {
  const threshold = isNight ? 43 : 55
  const alarmThreshold = isNight ? 45 : 60
  if (level >= alarmThreshold) return { label: "Alarm", color: "bg-red-100 text-red-600" }
  if (level >= threshold) return { label: "Warnung", color: "bg-yellow-100 text-yellow-700" }
  return { label: "Normal", color: "bg-emerald-100 text-emerald-700" }
}

function isNightTime(time: string) {
  const [h] = time.split(":").map(Number)
  return h < 6 || h >= 22
}

export default function OrtTablePage() {
  const [interval, setInterval] = useState<"24h" | "7d">("24h")
  const [showOnlyExceeded, setShowOnlyExceeded] = useState(false)
  const [page, setPage] = useState(1)

  const data = useStationData("ort", interval)

  const filtered = useMemo(() => {
    let d = data
    if (showOnlyExceeded) {
      d = d.filter(row => {
        const night = isNightTime(row.time)
        const { label } = getStatus(row.las, night)
        return label !== "Normal"
      })
    }
    return d.sort((a, b) => b.time.localeCompare(a.time))
  }, [data, showOnlyExceeded])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const last = filtered[0]

  return (
    <div className="space-y-6">
      {last && (
        <Card className="sticky top-2 z-10 bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Letzter Wert</CardTitle>
            <Badge className={getStatus(last.las, isNightTime(last.time)).color}>{getStatus(last.las, isNightTime(last.time)).label}</Badge>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            <div><span className="font-medium">Zeit:</span> {last.time}</div>
            <div><span className="font-medium">dB:</span> {last.las.toFixed(1)}</div>
            <div><span className="font-medium">Wind:</span> {last.ws ?? "-"} km/h</div>
            <div><span className="font-medium">Richtung:</span> {last.wd ?? "-"}</div>
            <div><span className="font-medium">Luftfeuchte:</span> {last.rh ?? "-"} %</div>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={interval} onValueChange={v => { setInterval(v as "24h" | "7d"); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue /> </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Letzte 24h</SelectItem>
            <SelectItem value="7d">Letzte 7 Tage</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={showOnlyExceeded} onChange={e => { setShowOnlyExceeded(e.target.checked); setPage(1) }} className="accent-red-500" />
          Nur Grenzwert-Überschreitungen
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zeit</TableHead>
              <TableHead>dB</TableHead>
              <TableHead>Wind (km/h)</TableHead>
              <TableHead>Richtung</TableHead>
              <TableHead>Luftfeuchte (%)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((row, i) => {
              const night = isNightTime(row.time)
              const status = getStatus(row.las, night)
              return (
                <TableRow key={i} className={status.label !== "Normal" ? (status.label === "Alarm" ? "bg-red-50 dark:bg-red-900/30" : "bg-yellow-50 dark:bg-yellow-900/30") : ""}>
                  <TableCell>{row.time}</TableCell>
                  <TableCell className="font-semibold">{row.las.toFixed(1)}</TableCell>
                  <TableCell>{row.ws ?? "-"}</TableCell>
                  <TableCell>{row.wd ?? "-"}</TableCell>
                  <TableCell>{row.rh ?? "-"}</TableCell>
                  <TableCell><Badge className={status.color}>{status.label}</Badge></TableCell>
                </TableRow>
              )
            })}
            {paged.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-gray-400">Keine Daten gefunden.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} aria-disabled={page === 1} />
            </PaginationItem>
            {Array.from({ length: pageCount }).map((_, idx) => (
              <PaginationItem key={idx}>
                <PaginationLink isActive={page === idx + 1} onClick={() => setPage(idx + 1)}>{idx + 1}</PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext onClick={() => setPage(p => Math.min(pageCount, p + 1))} aria-disabled={page === pageCount} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
} 