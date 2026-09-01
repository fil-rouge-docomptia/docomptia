import { History } from 'lucide-react'

import {
  DashboardSectionAction,
  DashboardSectionHeader,
} from '@/components/dashboard/DashboardSectionHeader'
import { Card } from '@/components/ui/card'

export function DashboardActivityPanel() {
  return (
    <section aria-labelledby="dashboard-activity-title" className="min-w-0 max-w-full">
      <DashboardSectionHeader
        action={<DashboardSectionAction>View all</DashboardSectionAction>}
        description="Latest workspace events."
        title="Recent activity"
        titleId="dashboard-activity-title"
      />
      <Card className="flex min-h-[172px] min-w-0 max-w-full items-center justify-center p-6 text-center shadow-elevation-1">
        <div className="max-w-xs">
          <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <History aria-hidden="true" className="size-4" />
          </span>
          <p className="mt-3 text-sm font-medium text-foreground">Activity feed unavailable</p>
          <p className="mt-1 text-xs leading-4 text-muted-foreground">
            No activity API is exposed for this workspace yet.
          </p>
        </div>
      </Card>
    </section>
  )
}
