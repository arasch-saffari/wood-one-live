"use client";

import React from "react"
import { StationDashboardPage } from "@/components/StationDashboardPage"
import { AllStationsTable } from "@/components/AllStationsTable"
import { useStationData } from "@/hooks/useStationData"
import { useConfig } from "@/hooks/useConfig"

export default function OrtPage() {
  const ortDataRaw = useStationData("ort", "24h", 60000, 1, 100000, "15min").data ?? [];
  const { config } = useConfig();
  const ortData = ortDataRaw.map(row => ({ ...row, station: "Ort" }));
  return (
    <>
      <StationDashboardPage station="ort" />
      <AllStationsTable
        ortData={ortData}
        heuballernData={[]}
        technoData={[]}
        bandData={[]}
        config={config ?? {}}
        granularity={"15min"}
      />
    </>
  )
}
