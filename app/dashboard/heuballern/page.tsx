"use client"

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

export default function HeuballernPage() {
  const [page, setPage] = useState(1)
  const [alarmPage, setAlarmPage] = useState(1)
  const pageSize = 25
  const heuballernDataObj = useStationData("heuballern", "24h", 60000, page, pageSize, "15min")
  const { config } = useConfig();
  const heuballernData = heuballernDataObj.data?.map(row => ({ ...row, station: "Heuballern" })) ?? [];
  const [alarmRows, setAlarmRows] = useState<any[]>([])
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
        heuballernData={(showOnlyAlarms ? [] : heuballernData).map(row => ({
          ...row,
          station: "Heuballern",
          time: row.time && /^\d{2}:\d{2}/.test(row.time) ? row.time.slice(0, 5) : (row.datetime && row.datetime.length >= 16 ? row.datetime.slice(11, 16) : undefined)
        }))}
        technoData={[]}
        bandData={[]}
        config={config as ConfigType}
        granularity={"15min"}
        page={showOnlyAlarms ? alarmPage : page}
        setPage={showOnlyAlarms ? setAlarmPage : setPage}
        pageSize={pageSize}
        totalCount={showOnlyAlarms ? alarmTotal : heuballernDataObj.totalCount}
        alarmRows={showOnlyAlarms ? alarmRows.map(row => ({
          ...row,
          station: "heuballern",
          time: row.time && /^\d{2}:\d{2}/.test(row.time) ? row.time.slice(0, 5) : (row.datetime && row.datetime.length >= 16 ? row.datetime.slice(11, 16) : undefined)
        })) : undefined}
        showOnlyAlarms={showOnlyAlarms}
        onAlarmToggle={handleAlarmToggle}
        sortKey="datetime"
        sortDir="desc"
      />
    </>
  )
}
