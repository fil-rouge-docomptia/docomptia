import { CalendarDays } from 'lucide-react'

import {
  dashboardPeriodOptions,
  type DashboardPeriodPreset,
} from '@/components/dashboard/dashboard-period'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type DashboardPeriodSelectProps = {
  onValueChange: (value: DashboardPeriodPreset) => void
  value: DashboardPeriodPreset
}

export function DashboardPeriodSelect({
  onValueChange,
  value,
}: DashboardPeriodSelectProps) {
  return (
    <Select
      onValueChange={(nextValue) => onValueChange(nextValue as DashboardPeriodPreset)}
      value={value}
    >
      <SelectTrigger
        aria-label="Dashboard period"
        className="h-11 w-[180px] justify-start gap-2 md:h-10 md:w-[190px] [&>svg:last-child]:ml-auto"
      >
        <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
        <SelectValue className="min-w-0 flex-1 text-left" />
      </SelectTrigger>
      <SelectContent align="start" className="w-[var(--radix-select-trigger-width)]">
        {dashboardPeriodOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
