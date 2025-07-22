import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "@/components/ui/pagination"
import { StatusBadge } from "@/components/StatusBadge"
import { ReactNode, useState } from "react"

export interface DataTableColumn<T extends Record<string, unknown> = Record<string, unknown>> {
  label: string
  key: keyof T & string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
}

export interface DataTableFilter {
  search?: string;
  from?: string;
  to?: string;
}

export interface DataTableProps<T extends Record<string, unknown> = Record<string, unknown>> {
  data: T[]
  columns: DataTableColumn<T>[]
  statusFn?: (row: T) => { label: string; color: string }
  page?: number
  pageCount?: number
  onPageChange?: (page: number) => void
  filter?: DataTableFilter
  onFilterChange?: (filter: DataTableFilter) => void
  loading?: boolean
  onSort?: (key: keyof T & string, direction: 'asc' | 'desc') => void
  sortKey?: keyof T & string
  sortDirection?: 'asc' | 'desc'
  enableExport?: boolean
  exportFileName?: string
}

function exportToCSV<T extends Record<string, unknown>>(data: T[], columns: DataTableColumn<T>[], fileName: string) {
  const header = columns.map(col => col.label).join(',')
  const rows = data.map(row =>
    columns.map(col => {
      const val = col.render ? col.render(row) : row[col.key]
      return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
    }).join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  statusFn,
  page = 1,
  pageCount = 1,
  onPageChange,
  filter,
  onFilterChange,
  loading = false,
  onSort,
  sortKey,
  sortDirection,
  enableExport = false,
  exportFileName = 'export.csv',
}: DataTableProps<T>) {
  const [internalSortKey, setInternalSortKey] = useState<keyof T & string | undefined>(sortKey)
  const [internalSortDir, setInternalSortDir] = useState<'asc' | 'desc'>(sortDirection || 'asc')
  const [search, setSearch] = useState(filter?.search || '')
  const [from, setFrom] = useState(filter?.from || '')
  const [to, setTo] = useState(filter?.to || '')

  function handleSort(key: keyof T & string) {
    let dir: 'asc' | 'desc' = 'asc'
    if (internalSortKey === key) {
      dir = internalSortDir === 'asc' ? 'desc' : 'asc'
    }
    setInternalSortKey(key)
    setInternalSortDir(dir)
    if (onSort) onSort(key, dir)
  }

  function handleFilterChange() {
    if (onFilterChange) onFilterChange({ search, from, to })
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-2">
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder="Suche..."
            value={search}
            onChange={e => { setSearch(e.target.value); if (onFilterChange) onFilterChange({ search: e.target.value, from, to }) }}
            className="border rounded px-2 py-1 text-sm"
            aria-label="Textsuche"
          />
          <input
            type="date"
            value={from}
            onChange={e => { setFrom(e.target.value); if (onFilterChange) onFilterChange({ search, from: e.target.value, to }) }}
            className="border rounded px-2 py-1 text-sm"
            aria-label="Von-Datum"
          />
          <input
            type="date"
            value={to}
            onChange={e => { setTo(e.target.value); if (onFilterChange) onFilterChange({ search, from, to: e.target.value }) }}
            className="border rounded px-2 py-1 text-sm"
            aria-label="Bis-Datum"
          />
          <button
            className="px-2 py-1 rounded bg-slate-200 text-xs hover:bg-slate-300"
            onClick={handleFilterChange}
            type="button"
          >
            Filter anwenden
          </button>
        </div>
        {enableExport && (
          <button
            className="px-3 py-1 rounded bg-emerald-500 text-white text-xs hover:bg-emerald-600"
            onClick={() => exportToCSV(data, columns, exportFileName)}
            disabled={loading || data.length === 0}
          >
            Export CSV
          </button>
        )}
      </div>
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
              <TableRow><TableCell colSpan={columns.length + (statusFn ? 1 : 0)}>Lade Daten...</TableCell></TableRow>
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