import React from 'react'
import { Card } from "@/components/ui/card"

export function WideCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="max-w-6xl mx-auto w-full">
      {children}
    </Card>
  )
} 