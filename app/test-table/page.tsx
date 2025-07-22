"use client";
import { useState, useEffect } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';

const STATIONS = ['ort', 'band', 'heuballern', 'techno'];

export default function TestTablePage() {
  const [station, setStation] = useState('heuballern');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/station-data?station=${station}&interval=24h&granularity=1min&pageSize=0`)
      .then(res => res.json())
      .then(res => setData(res.data || []))
      .finally(() => setLoading(false));
  }, [station]);

  const columns: DataTableColumn[] = [
    { label: 'Datum/Zeit', key: 'datetime', sortable: true },
    { label: 'Uhrzeit', key: 'time', sortable: true },
    { label: 'Max SPL A Fast', key: 'las', sortable: true },
  ];

  return (
    <div className="max-w-6xl mx-auto w-full py-8">
      <h1 className="text-2xl font-bold mb-4">Test: Messwerte-Tabelle (Standalone)</h1>
      <div className="mb-4">
        <label className="mr-2 font-semibold">Station:</label>
        <select value={station} onChange={e => setStation(e.target.value)} className="border rounded px-2 py-1">
          {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <DataTable data={data} columns={columns} loading={loading} />
    </div>
  );
} 