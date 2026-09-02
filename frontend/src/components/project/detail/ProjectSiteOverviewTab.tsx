import { CalendarDays, FolderKanban, History, ListChecks } from 'lucide-react'

import { formatProjectSiteDate } from '@/components/project/project-site-utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { ProjectSite } from '@/types/project-site'

export function ProjectSiteOverviewTab({ projectSite }: { projectSite: ProjectSite }) {
  const metrics = [
    { icon: FolderKanban, label: 'Type', value: 'Construction site' },
    { icon: ListChecks, label: 'Status', value: projectSite.active ? 'Active' : 'Inactive' },
    { icon: CalendarDays, label: 'Created', value: formatProjectSiteDate(projectSite.createdAt) },
    { icon: History, label: 'Last updated', value: formatProjectSiteDate(projectSite.updatedAt) },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon

          return (
            <Card className="shadow-elevation-1" key={metric.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-xl font-semibold tracking-[-0.25px] text-foreground">
                  {metric.value}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="shadow-elevation-1">
        <CardHeader className="p-4">
          <h2 className="text-lg font-semibold text-foreground">Project information</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Information available in the project classification.
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <dl className="divide-y divide-border border-y border-border">
            <div className="grid gap-2 py-3 sm:grid-cols-[10rem_1fr]">
              <dt className="text-xs font-medium text-foreground">Description</dt>
              <dd className="text-xs text-muted-foreground">
                {projectSite.description || 'No description provided'}
              </dd>
            </div>
            <div className="grid gap-2 py-3 sm:grid-cols-[10rem_1fr]">
              <dt className="text-xs font-medium text-foreground">Internal ID</dt>
              <dd className="text-xs text-muted-foreground">
                {projectSite.classificationId}
              </dd>
            </div>
            <div className="grid gap-2 py-3 sm:grid-cols-[10rem_1fr]">
              <dt className="text-xs font-medium text-foreground">Classification</dt>
              <dd>
                <Badge variant="outline">{projectSite.type}</Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
