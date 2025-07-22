"use client";
import { useState, useEffect } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';

// Typdefinition für StationMeasurement
export interface StationMeasurement {
  station: string;
  date: string;
  time: string;
  maxSPLAFast: number;
  [key: string]: string | number;
}

const STATIONS = ['ort', 'band', 'heuballern', 'techno'];

export default function TestPage() {
  const [station, setStation] = useState(STATIONS[0]);
  const [data, setData] = useState<StationMeasurement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/station-data?station=${station}`)
      .then(res => res.json())
      .then(res => {
        // Filtere null-Werte und Duplikate (falls API/Import fehlerhaft)
        const seen = new Set();
        const filtered = (res.data || []).filter((row: StationMeasurement) => {
          if (!row || row.maxSPLAFast == null) return false;
          const key = `${row.date}_${row.time}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setData(filtered);
      })
      .finally(() => setLoading(false));
  }, [station]);

  const columns: DataTableColumn[] = [
    { label: 'Datum', key: 'date', sortable: true },
    { label: 'Uhrzeit', key: 'time', sortable: true },
    { label: 'Max SPL A Fast', key: 'maxSPLAFast', sortable: true, render: (row: StationMeasurement) => row.maxSPLAFast ?? 'keine daten' },
  ];

  return (
    <div className="max-w-6xl mx-auto w-full py-8">
      <h1 className="text-2xl font-bold mb-4">Test: Messwerte-Tabelle</h1>
      <div className="mb-4">
        <label className="mr-2 font-semibold">Station:</label>
        <select value={station} onChange={e => setStation(e.target.value)} className="border rounded px-2 py-1">
          {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <DataTable
        data={data}
        columns={columns}
        loading={loading}
        // Key-Prop für Zeilen: Kombination aus date, time, station
        // (DataTable nutzt index, aber wir geben explizit unique keys mit)
        // rowKey={(row) => `${row.date}_${row.time}_${station}`}
      />
    </div>
  );
} 