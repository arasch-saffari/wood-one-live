import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "@/components/ui/pagination"
import { StatusBadge } from "@/components/StatusBadge"
import { LoadingSpinner } from "@/components/LoadingSpinner"
import { ReactNode, useState } from "react"
import React from "react"

export interface DataTableColumn<T = unknown> {
  label: string
  key: string
  render?: (row: T) => ReactNode
  sortable?: boolean
}

export interface DataTableProps<T = unknown> {
  data: T[]
  columns: DataTableColumn<T>[]
  statusFn?: (row: T) => { label: string; color: string }
  page?: number
  pageCount?: number
  onPageChange?: (page: number) => void
  filter?: ReactNode
  loading?: boolean
  onSort?: (key: string, direction: 'asc' | 'desc') => void
  sortKey?: string
  sortDirection?: 'asc' | 'desc'
}

export function DataTable<T = unknown>({
  data,
  columns,
  statusFn,
  page = 1,
  pageCount = 1,
  onPageChange,
  filter,
  loading,
  onSort,
  sortKey,
  sortDirection,
}: DataTableProps<T>) {
  const [internalSortKey, setInternalSortKey] = useState<string | undefined>(sortKey)
  const [internalSortDir, setInternalSortDir] = useState<'asc' | 'desc'>(sortDirection || 'asc')

  function handleSort(key: string) {
    let dir: 'asc' | 'desc' = 'asc'
    if (internalSortKey === key) {
      dir = internalSortDir === 'asc' ? 'desc' : 'asc'
    }
    setInternalSortKey(key)
    setInternalSortDir(dir)
    if (onSort) onSort(key, dir)
  }

  return (
    <div>
      {filter && <div className="mb-4">{filter}</div>}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead
                  key={col.key}
                  className={col.sortable ? 'cursor-pointer select-none' : ''}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  {col.label}
                  {col.sortable && (
                    <span className="ml-1 text-xs">
                      {internalSortKey === col.key ? (internalSortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  )}
                </TableHead>
              ))}
              {statusFn && <TableHead>Status</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (statusFn ? 1 : 0)}>
                  <LoadingSpinner text="Daten werden geladen..." />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length + (statusFn ? 1 : 0)}>Keine Daten</TableCell></TableRow>
            ) : data.map((row, i) => {
              const status = statusFn ? statusFn(row) : null
              return (
                <TableRow key={i} className={status ? (status.label === "Alarm" ? "bg-red-50 dark:bg-red-900/30" : status.label === "Warnung" ? "bg-yellow-50 dark:bg-yellow-900/30" : "") : ""}>
                  {columns.map(col => (
                    <TableCell key={col.key}>{col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key])}</TableCell>
                  ))}
                  {status && <TableCell><StatusBadge status={status.label as "Alarm" | "Warnung" | "Normal"} color={status.color} /></TableCell>}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {onPageChange && pageCount > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => onPageChange(Math.max(1, page - 1))} aria-disabled={page === 1} />
            </PaginationItem>
            {[...Array(pageCount)].map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink isActive={page === i + 1} onClick={() => onPageChange(i + 1)}>{i + 1}</PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext onClick={() => onPageChange(Math.min(pageCount, page + 1))} aria-disabled={page === pageCount} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
} 