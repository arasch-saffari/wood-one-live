import { Card } from "@/components/ui/card"
import { ReactNode } from "react"

export function WideCard({ children }: { children: ReactNode }) {
  return (
    <Card className="max-w-6xl mx-auto w-full">
      {children}
    </Card>
  )
} 