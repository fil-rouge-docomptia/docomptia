import { ChevronDown } from 'lucide-react'

import { DashboardPeriodSelect } from '@/components/dashboard/DashboardPeriodSelect'
import type { DashboardPeriodPreset } from '@/components/dashboard/dashboard-period'
import { Button } from '@/components/ui/button'

type ReportFiltersProps = {
  onPeriodChange: (value: DashboardPeriodPreset) => void
  period: DashboardPeriodPreset
}

const unavailableFilters = ['Supplier', 'Project / Site', 'Category']

export function ReportFilters({ onPeriodChange, period }: ReportFiltersProps) {
  return (
    <div aria-label="Report filters" className="flex flex-wrap items-center gap-2" role="group">
      <DashboardPeriodSelect
        ariaLabel="Report date range"
        onValueChange={onPeriodChange}
        value={period}
      />
      {unavailableFilters.map((filter) => (
        <Button
          className="h-11 justify-between md:h-10"
          disabled
          key={filter}
          title={`${filter} reporting is not supported by the API yet`}
          type="button"
          variant="outline"
        >
          {filter}
          <ChevronDown aria-hidden="true" />
        </Button>
      ))}
    </div>
  )
}
