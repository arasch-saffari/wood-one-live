"use client";
import { useState } from "react";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { useStationData, StationMeasurement } from "@/hooks/useStationData";

export default function HeuballernTablePage() {
  const { data, loading, error } = useStationData("heuballern");
  const columns: DataTableColumn<StationMeasurement>[] = [
    { label: "Datum", key: "date" },
    { label: "Uhrzeit", key: "time" },
    { label: "Max SPL A Fast", key: "maxSPLAFast", render: (row) => row.maxSPLAFast ?? 'keine daten' },
  ];
  return (
    <div className="space-y-6">
      <DataTable<StationMeasurement>
        data={data}
        columns={columns}
        loading={loading}
        filter={null}
      />
      {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
    </div>
  );
} 