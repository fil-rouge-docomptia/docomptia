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
        className="h-11 w-[180px] md:h-10 md:w-[190px]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          <SelectValue />
        </span>
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
