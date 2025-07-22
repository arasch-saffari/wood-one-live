"use client"

import React, { useState, useMemo, memo } from "react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "@/components/ui/pagination"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useStationData } from "@/hooks/useStationData"
import { StatusBadge } from "@/components/StatusBadge"
import { useThresholdStatus } from "@/hooks/useThresholdStatus"
import { DataTable } from "@/components/DataTable"
import { ErrorMessage } from "@/components/ErrorMessage"
import { LoadingSpinner } from "@/components/LoadingSpinner"

const PAGE_SIZE = 20

function isNightTime(time: string) {
  const [h] = time.split(":").map(Number)
  return h < 6 || h >= 22
}

const MemoTableRow = memo(function MemoTableRow({ row, warning, alarm }: { row: any, warning: number, alarm: number }) {
  const las = typeof row.las === 'number' && !isNaN(row.las) ? row.las : 0
  const status = useThresholdStatus(las, warning, alarm)
  return (
    <TableRow className={status.label !== "Normal" ? (status.label === "Alarm" ? "bg-red-50 dark:bg-red-900/30" : "bg-yellow-50 dark:bg-yellow-900/30") : ""}>
      <TableCell>{row.time}</TableCell>
      <TableCell className="font-semibold">{row.las.toFixed(1)}</TableCell>
      <TableCell>{row.ws ?? "-"}</TableCell>
      <TableCell>{row.wd ?? "-"}</TableCell>
      <TableCell>{row.rh ?? "-"}</TableCell>
      <TableCell><StatusBadge status={status.label as any} color={status.color} /></TableCell>
    </TableRow>
  )
})

export default function OrtTablePage() {
  const [interval, setInterval] = useState<"24h" | "7d">("24h")
  const [showOnlyExceeded, setShowOnlyExceeded] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  // Pagination-API nutzen
  const { data, totalCount, loading, error } = useStationData("ort", interval, "15min", page, PAGE_SIZE)

  // Filterung clientseitig nur für Grenzwert-Überschreitungen
  const filtered = useMemo(() => {
    if (!showOnlyExceeded) return data
    return data.filter(row => {
      const warning = typeof (row as any).warningThreshold === 'number' ? (row as any).warningThreshold : 55
      const alarm = typeof (row as any).alarmThreshold === 'number' ? (row as any).alarmThreshold : 60
      const las = typeof row.las === 'number' && !isNaN(row.las) ? row.las : 0
      const status = useThresholdStatus(las, warning, alarm)
      return status.label !== "Normal"
    })
  }, [data, showOnlyExceeded])

  const pageCount = Math.ceil(totalCount / PAGE_SIZE)
  const last = filtered[0]

  const columns = [
    { label: "Zeit", key: "time" },
    { label: "dB", key: "las", render: (row: any) => row.las.toFixed(1) },
    { label: "Wind", key: "ws", render: (row: any) => row.ws ?? "-" },
    { label: "Richtung", key: "wd", render: (row: any) => row.wd ?? "-" },
    { label: "Luftfeuchte", key: "rh", render: (row: any) => row.rh ?? "-" },
  ]
  const statusFn = (row: any) => useThresholdStatus(row.las, row.warningThreshold, row.alarmThreshold)

  return (
    <>
      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}
      <DataTable
        data={filtered}
        columns={columns}
        statusFn={statusFn}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        filter={
          <>
            <Select value={interval} onValueChange={v => { setInterval(v as "24h" | "7d"); setPage(1) }}>
              <SelectTrigger className="w-32"><SelectValue /> </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Letzte 24h</SelectItem>
                <SelectItem value="7d">Letzte 7 Tage</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 cursor-pointer select-none ml-4">
              <input type="checkbox" checked={showOnlyExceeded} onChange={e => { setShowOnlyExceeded(e.target.checked); setPage(1) }} className="accent-red-500" />
              Nur Grenzwert-Überschreitungen
            </label>
          </>
        }
      />
    </>
  )
} 