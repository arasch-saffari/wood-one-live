import React from 'react'
import { StationDashboardPage } from './StationDashboardPage'

// Memoized wrapper für StationDashboardPage um unnötige Re-Renders zu vermeiden
export const MemoizedStationDashboard = React.memo(function MemoizedStationDashboard({
  station,
  title,
  icon,
  color
}: {
  station: string
  title: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <StationDashboardPage
      station={station}
      title={title}
      icon={icon}
      color={color}
    />
  )
}, (prevProps, nextProps) => {
  // Custom comparison function - nur re-rendern wenn sich relevante Props ändern
  return (
    prevProps.station === nextProps.station &&
    prevProps.title === nextProps.title &&
    prevProps.color === nextProps.color
  )
})

export default MemoizedStationDashboard