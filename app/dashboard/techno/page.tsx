"use client"

import React from "react"
import { StationDashboardPage } from "@/components/StationDashboardPage"
import { AllStationsTable } from "@/components/AllStationsTable"
import { useStationData } from "@/hooks/useStationData"
import { useConfig } from "@/hooks/useConfig"

export default function TechnoPage() {
  const technoDataRaw = useStationData("techno", "24h", 60000, 1, 100000, "15min").data ?? [];
  const { config } = useConfig();
  const technoData = technoDataRaw.map(row => ({ ...row, station: "Techno Floor" }));
  return (
    <>
      <StationDashboardPage station="techno" />
      <AllStationsTable
        ortData={[]}
        heuballernData={[]}
        technoData={technoData}
        bandData={[]}
        config={config ?? {}}
        granularity={"15min"}
      />
    </>
  )
}
