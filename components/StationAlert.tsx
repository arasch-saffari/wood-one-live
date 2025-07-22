import { Card, CardContent } from "@/components/ui/card"
import { ReactNode } from "react"

interface StationAlertProps {
  bg: string
  icon: ReactNode
  title: string
  text: string
  textColor: string
}

export function StationAlert({ bg, icon, title, text, textColor }: StationAlertProps) {
  return (
    <Card className={`bg-gradient-to-r ${bg}`}>
      <CardContent className="py-4">
        <div className="flex items-center space-x-3">
          {icon}
          <div>
            <p className={`font-medium ${textColor} text-sm lg:text-base`}>{title}</p>
            <p className={`text-xs lg:text-sm ${textColor}`}>{text}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 