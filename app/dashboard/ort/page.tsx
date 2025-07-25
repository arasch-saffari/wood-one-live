"use client";

import React, { useState, useEffect } from "react"
import { StationDashboardPage } from "@/components/StationDashboardPage"
import { AllStationsTable } from "@/components/AllStationsTable"
import { useStationData } from "@/hooks/useStationData"
import { useConfig } from "@/hooks/useConfig"

type StationKey = "ort" | "techno" | "band" | "heuballern";
type ThresholdBlock = {
  from: string;
  to: string;
  warning: number;
  alarm: number;
  las: number;
  laf: number;
};
type ConfigType = {
  warningThreshold: number;
  alarmThreshold: number;
  lasThreshold: number;
  lafThreshold: number;
  stations: StationKey[];
  enableNotifications: boolean;
  csvAutoProcess: boolean;
  backupRetentionDays: number;
  uiTheme: string;
  calculationMode: string;
  adminEmail: string;
  weatherApiKey: string;
  apiCacheDuration: number;
  pollingIntervalSeconds: number;
  chartLimit: number;
  pageSize: number;
  defaultInterval: string;
  defaultGranularity: string;
  allowedIntervals: string[];
  allowedGranularities: string[];
  chartColors: {
    primary: string;
    wind: string;
    humidity: string;
    temperature: string;
    warning: string;
    danger: string;
    alarm: string;
    reference: string;
    gradients: Record<string, { from: string; to: string }>;
  };
  thresholdsByStationAndTime: Record<StationKey, ThresholdBlock[]>;
  chartVisibleLines: Record<StationKey, string[]>;
};

export default function OrtPage() {
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
  const ortDataObj = useStationData("ort", "24h", 60000, page, pageSize, "15min")
  const { config } = useConfig();
  const [alarmRows, setAlarmRows] = useState<Array<{
    datetime?: string
    time?: string
    las?: number
    ws?: number
    wd?: number | string
    rh?: number
    station: string
  }>>([])
  const ortData = ortDataObj.data?.map(row => ({ ...row, station: "Ort" })) ?? [];
  // State für Alarmdaten und Modus
  const [showOnlyAlarms, setShowOnlyAlarms] = useState(false)
  const [alarmTotal, setAlarmTotal] = useState(0)

  // Lade alle Alarme nur wenn Toggle aktiv
  useEffect(() => {
    if (!showOnlyAlarms) return
    fetch(`/api/station-data?station=ort&interval=24h&page=${alarmPage}&pageSize=${pageSize}&aggregate=alarms`)
      .then(res => res.json())
      .then(json => {
        setAlarmRows(json.data ?? [])
        setAlarmTotal(json.totalCount ?? 0)
      })
  }, [showOnlyAlarms, alarmPage, pageSize])

  if (ortDataObj.loading) {
    return <div className="flex justify-center items-center h-40"><span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></span> Daten werden geladen ...</div>;
  }

  // Handler für Alarm-Toggle
  function handleAlarmToggle(val: boolean) {
    setShowOnlyAlarms(val)
    setAlarmPage(1)
  }

  return (
    <>
      <StationDashboardPage station="ort" />
      <AllStationsTable
        ortData={(showOnlyAlarms ? [] : ortData).map(row => ({
          ...row,
          station: "Ort",
          time: row.time && /^\d{2}:\d{2}/.test(row.time) ? row.time.slice(0, 5) : (row.datetime && row.datetime.length >= 16 ? row.datetime.slice(11, 16) : undefined)
        }))}
        heuballernData={[]}
        technoData={[]}
        bandData={[]}
        config={config as ConfigType}
        granularity={"15min"}
        page={showOnlyAlarms ? alarmPage : page}
        setPage={showOnlyAlarms ? setAlarmPage : setPage}
        pageSize={pageSize}
        totalCount={showOnlyAlarms ? alarmTotal : ortDataObj.totalCount}
        alarmRows={showOnlyAlarms ? alarmRows.map(row => ({
          ...row,
          station: "ort",
          time: row.time && /^\d{2}:\d{2}/.test(row.time) ? row.time.slice(0, 5) : (row.datetime && row.datetime.length >= 16 ? row.datetime.slice(11, 16) : undefined)
        })) : undefined}
        showOnlyAlarms={showOnlyAlarms}
        onAlarmToggle={handleAlarmToggle}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />
    </>
  )
}
