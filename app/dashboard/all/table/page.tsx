"use client";
import React, { useState, useEffect } from "react";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { useStationData, StationMeasurement } from "@/hooks/useStationData";

const STATIONS = [
  { id: "ort", name: "Ort" },
  { id: "techno", name: "Techno Floor" },
  { id: "band", name: "Band Bühne" },
  { id: "heuballern", name: "Heuballern" },
];

export default function AllTablePage() {
  const [station, setStation] = useState(STATIONS[0].id);
  const { data, loading, error } = useStationData(station);

  const columns: DataTableColumn<StationMeasurement>[] = [
    { label: "Station", key: "station" },
    { label: "Datum", key: "date" },
    { label: "Uhrzeit", key: "time" },
    { label: "Max SPL A Fast", key: "maxSPLAFast", render: (row) => row.maxSPLAFast ?? 'keine daten' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <span>Station:</span>
        <select value={station} onChange={e => setStation(e.target.value)} className="border rounded px-2 py-1 text-sm">
          {STATIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
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