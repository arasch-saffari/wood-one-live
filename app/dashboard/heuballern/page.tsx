"use client"

import React from "react"
import { StationDashboardPage } from "@/components/StationDashboardPage"
import { AllStationsTable } from "@/components/AllStationsTable"
import { useStationData } from "@/hooks/useStationData"
import { useConfig } from "@/hooks/useConfig"

export default function HeuballernPage() {
  const heuballernDataObj = useStationData("heuballern", "24h", 60000, 1, 200, "15min")
  const { config } = useConfig();
  const heuballernData = heuballernDataObj.data?.map(row => ({ ...row, station: "Heuballern" })) ?? [];
  if (heuballernDataObj.loading) {
    return <div className="flex justify-center items-center h-40"><span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></span> Daten werden geladen ...</div>;
  }
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
