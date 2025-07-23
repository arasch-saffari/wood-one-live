"use client"

import React from "react"
import { StationDashboardPage } from "@/components/StationDashboardPage"
import { AllStationsTable } from "@/components/AllStationsTable"
import { useStationData } from "@/hooks/useStationData"
import { useConfig } from "@/hooks/useConfig"

export default function HeuballernPage() {
  const heuballernDataRaw = useStationData("heuballern", "24h", 60000, 1, 100000, "15min").data ?? [];
  const { config } = useConfig();
  const heuballernData = heuballernDataRaw.map(row => ({ ...row, station: "Heuballern" }));
  return (
    <>
      <StationDashboardPage station="heuballern" />
      <AllStationsTable
        ortData={[]}
        heuballernData={heuballernData}
        technoData={[]}
        bandData={[]}
        config={config ?? {}}
        granularity={"15min"}
      />
    </>
  )
}
