import type { KeyboardEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { formatProjectSiteDate } from '@/components/project/project-site-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ProjectSite } from '@/types/project-site'

export function ProjectSiteTable({ projectSites }: { projectSites: ProjectSite[] }) {
  const navigate = useNavigate()
  const openProjectSite = (projectSiteId: number) => navigate(`/projects/${projectSiteId}`)
  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    projectSiteId: number,
  ) => {
    if (event.key === 'Enter') {
      openProjectSite(projectSiteId)
    }
  }

  return (
    <Table className="min-w-[820px]">
      <TableHeader className="bg-muted/70">
        <TableRow className="h-10 hover:bg-transparent">
          <TableHead className="h-10 px-4 text-xs">Project / Site</TableHead>
          <TableHead className="h-10 px-4 text-xs">Type</TableHead>
          <TableHead className="h-10 px-4 text-xs">Description</TableHead>
          <TableHead className="h-10 px-4 text-xs">Status</TableHead>
          <TableHead className="h-10 px-4 text-xs">Last updated</TableHead>
          <TableHead className="h-10 px-4 text-right text-xs">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projectSites.map((projectSite) => (
          <TableRow
            aria-label={`Open project or site ${projectSite.name}`}
            className="h-14 cursor-pointer focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            key={projectSite.classificationId}
            onClick={() => openProjectSite(projectSite.classificationId)}
            onKeyDown={(event) => handleRowKeyDown(event, projectSite.classificationId)}
            role="link"
            tabIndex={0}
          >
            <TableCell className="h-14 max-w-60 px-4 py-2 text-xs font-medium text-foreground">
              <span className="block truncate">{projectSite.name}</span>
            </TableCell>
            <TableCell className="h-14 px-4 py-2 text-xs text-muted-foreground">
              Project / site
            </TableCell>
            <TableCell className="h-14 max-w-96 px-4 py-2 text-xs text-muted-foreground">
              <span className="block truncate">{projectSite.description || '—'}</span>
            </TableCell>
            <TableCell className="h-14 px-4 py-2">
              <Badge
                className={projectSite.active
                  ? 'border-transparent bg-success-muted text-success'
                  : undefined}
                variant={projectSite.active ? 'outline' : 'secondary'}
              >
                {projectSite.active ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
            <TableCell className="h-14 whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
              {formatProjectSiteDate(projectSite.updatedAt)}
            </TableCell>
            <TableCell className="h-14 px-2 py-2 text-right">
              <Button
                aria-label={`Open project or site ${projectSite.name}`}
                className="text-primary hover:text-primary"
                onClick={(event) => {
                  event.stopPropagation()
                  openProjectSite(projectSite.classificationId)
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Open
                <ChevronRight aria-hidden="true" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
