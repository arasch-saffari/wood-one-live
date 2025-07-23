"use client"

import React from "react"
import { StationDashboardPage } from "@/components/StationDashboardPage"
import { AllStationsTable } from "@/components/AllStationsTable"
import { useStationData } from "@/hooks/useStationData"
import { useConfig } from "@/hooks/useConfig"

export default function TechnoPage() {
  const technoDataObj = useStationData("techno", "24h", 60000, 1, 200, "15min")
  const { config } = useConfig();
  const technoData = technoDataObj.data?.map(row => ({ ...row, station: "Techno Floor" })) ?? [];
  if (technoDataObj.loading) {
    return <div className="flex justify-center items-center h-40"><span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></span> Daten werden geladen ...</div>;
  }
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
