import { Pencil } from 'lucide-react'

import { formatProjectSiteDate } from '@/components/project/project-site-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ProjectSite } from '@/types/project-site'

type ProjectSiteDetailHeaderProps = {
  canEdit: boolean
  onEdit: () => void
  projectSite: ProjectSite
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-2 break-words text-xs font-medium text-foreground">{value}</dd>
    </div>
  )
}

export function ProjectSiteDetailHeader({
  canEdit,
  onEdit,
  projectSite,
}: ProjectSiteDetailHeaderProps) {
  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-[-0.75px] text-foreground">
            {projectSite.name}
          </h1>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            Project and construction site overview.
          </p>
        </div>

        {canEdit ? (
          <Button className="self-start sm:self-auto" onClick={onEdit} type="button">
            <Pencil aria-hidden="true" />
            Edit project
          </Button>
        ) : null}
      </header>

      <dl className="grid gap-5 rounded-lg border border-border bg-card p-4 shadow-elevation-1 sm:grid-cols-2 xl:grid-cols-4">
        <DetailValue label="Project / Site" value={projectSite.name} />
        <DetailValue label="Type" value="Construction site" />
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd className="mt-2">
            <Badge
              className={projectSite.active
                ? 'border-transparent bg-success-muted text-success'
                : undefined}
              variant={projectSite.active ? 'outline' : 'secondary'}
            >
              {projectSite.active ? 'Active' : 'Inactive'}
            </Badge>
          </dd>
        </div>
        <DetailValue
          label="Last updated"
          value={formatProjectSiteDate(projectSite.updatedAt)}
        />
      </dl>
    </>
  )
}
