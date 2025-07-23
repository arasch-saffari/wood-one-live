import React from 'react'
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Table as TableIcon } from "lucide-react"

interface StationTableLinkProps {
  station: string
}

export function StationTableLink({ station }: StationTableLinkProps) {
  return (
    <div className="flex justify-end mb-4">
      <Button
        asChild
        variant="outline"
        size="sm"
        className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 bg-transparent"
      >
        <Link href={`/dashboard/${station}/table`}>
          <TableIcon className="w-4 h-4 mr-2" /> Tabellenansicht
        </Link>
      </Button>
    </div>
  )
} 