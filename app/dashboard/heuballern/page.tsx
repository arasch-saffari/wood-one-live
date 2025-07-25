"use client"

import React, { useState, useEffect } from "react"
import { StationDashboardPage } from "@/components/StationDashboardPage"
import { AllStationsTable, normalizeTableRow, TableRowType, StationKey, ConfigType } from '@/components/AllStationsTable';
import { useStationData } from "@/hooks/useStationData"
import { useConfig } from "@/hooks/useConfig"

export default function HeuballernPage() {
  const [page, setPage] = useState(1)
  const [alarmPage, setAlarmPage] = useState(1)
  const pageSize = 25
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('datetime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
  };
  const heuballernDataObj = useStationData("heuballern", "24h", 60000, page, pageSize, "15min")
  const { config } = useConfig();
  const heuballernData = heuballernDataObj.data?.map(row => ({ ...row, station: "Heuballern" })) ?? [];
  const [alarmRows, setAlarmRows] = useState<Array<{
    datetime?: string
    time?: string
    las?: number
    ws?: number
    wd?: number | string
    rh?: number
    station: string
  }>>([])
  const [showOnlyAlarms, setShowOnlyAlarms] = useState(false)
  const [alarmTotal, setAlarmTotal] = useState(0)

  useEffect(() => {
    if (!showOnlyAlarms) return
    fetch(`/api/station-data?station=heuballern&interval=24h&page=${alarmPage}&pageSize=${pageSize}&aggregate=alarms`)
      .then(res => res.json())
      .then(json => {
        setAlarmRows(json.data ?? [])
        setAlarmTotal(json.totalCount ?? 0)
      })
  }, [showOnlyAlarms, alarmPage, pageSize])

  if (heuballernDataObj.loading) {
    return <div className="flex justify-center items-center h-40"><span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></span> Daten werden geladen ...</div>;
  }

  function handleAlarmToggle(val: boolean) {
    setShowOnlyAlarms(val)
    setAlarmPage(1)
  }

  return (
    <>
      <StationDashboardPage station="heuballern" />
      <AllStationsTable
        ortData={[]}
        heuballernData={(showOnlyAlarms ? [] : heuballernData).map(row => normalizeTableRow(row, 'heuballern'))}
        technoData={[]}
        bandData={[]}
        config={config as ConfigType}
        granularity={"15min"}
        page={showOnlyAlarms ? alarmPage : page}
        setPage={showOnlyAlarms ? setAlarmPage : setPage}
        pageSize={pageSize}
        totalCount={showOnlyAlarms ? alarmTotal : heuballernDataObj.totalCount}
        alarmRows={showOnlyAlarms ? alarmRows.map(row => normalizeTableRow(row, 'heuballern')) : undefined}
        showOnlyAlarms={showOnlyAlarms}
        onAlarmToggle={handleAlarmToggle}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />
    </>
  )
}
