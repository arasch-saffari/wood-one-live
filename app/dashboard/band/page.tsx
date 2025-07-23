"use client"

import React from "react"
import { StationDashboardPage } from "@/components/StationDashboardPage"
import { AllStationsTable } from "@/components/AllStationsTable"
import { useStationData } from "@/hooks/useStationData"
import { useConfig } from "@/hooks/useConfig"

export default function BandPage() {
  const bandDataRaw = useStationData("band", "24h", 60000, 1, 100000, "15min").data ?? [];
  const { config } = useConfig();
  const bandData = bandDataRaw.map(row => ({ ...row, station: "Band Bühne" }));
  return (
    <>
      <StationDashboardPage station="band" />
      <AllStationsTable
        ortData={[]}
        heuballernData={[]}
        technoData={[]}
        bandData={bandData}
        config={config ?? {}}
        granularity={"15min"}
      />
    </>
  )
}
