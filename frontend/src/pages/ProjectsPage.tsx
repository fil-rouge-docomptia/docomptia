import { useEffect, useState } from 'react'
import { AlertCircle, Building2, ChevronDown, Plus, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { ProjectSiteDialog } from '@/components/project/ProjectSiteDialog'
import { ProjectSitePagination } from '@/components/project/ProjectSitePagination'
import { ProjectSiteTable } from '@/components/project/ProjectSiteTable'
import { canManageProjectSites } from '@/components/project/project-site-utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { listProjectSites } from '@/services/project-site'
import type { ProjectSitePage } from '@/types/project-site'

const PAGE_SIZE = 8

type ProjectSiteRequestState = {
  error: boolean
  projectSitePage: ProjectSitePage | null
  requestKey: string
}

function parsePage(value: string | null) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function ProjectSiteTableSkeleton() {
  return (
    <div
      aria-label="Loading projects and sites"
      className="overflow-hidden rounded-lg border border-border"
    >
      <div className="h-10 bg-muted/70" />
      {Array.from({ length: PAGE_SIZE }, (_, index) => (
        <div
          className="grid h-14 grid-cols-[1.1fr_0.8fr_1.6fr_0.7fr_0.8fr_0.6fr] items-center gap-4 border-b border-border px-4 last:border-b-0"
          key={index}
        >
          {Array.from({ length: 6 }, (__, cellIndex) => (
            <Skeleton className="h-4 w-full max-w-32" key={cellIndex} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [requestState, setRequestState] = useState<ProjectSiteRequestState>({
    error: false,
    projectSitePage: null,
    requestKey: '',
  })
  const [retryCount, setRetryCount] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const currentPage = parsePage(searchParams.get('page'))
  const requestKey = `${currentPage}:${retryCount}`
  const isCurrentRequest = requestState.requestKey === requestKey
  const error = isCurrentRequest && requestState.error
  const projectSitePage = isCurrentRequest ? requestState.projectSitePage : null

  useEffect(() => {
    const controller = new AbortController()

    listProjectSites(
      { page: currentPage - 1, size: PAGE_SIZE },
      controller.signal,
    )
      .then((nextProjectSitePage) => {
        setRequestState({
          error: false,
          projectSitePage: nextProjectSitePage,
          requestKey,
        })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setRequestState({ error: true, projectSitePage: null, requestKey })
        }
      })

    return () => controller.abort()
  }, [currentPage, requestKey])

  const handlePageChange = (page: number) => {
    setSearchParams({ page: String(page) })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={canManageProjectSites(user?.permissions) ? (
          <Button onClick={() => setCreateOpen(true)} type="button">
            <Plus aria-hidden="true" />
            Create project
          </Button>
        ) : undefined}
        description="Track invoice organization by project or construction site."
        title="Projects & sites"
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search projects and sites"
            className="h-9 border-input pl-9 text-sm"
            disabled
            placeholder="Search projects, sites, clients…"
            title="Project search is not supported by the API yet"
            type="search"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {['Client', 'Status', 'Manager'].map((filter) => (
            <Button
              disabled
              key={filter}
              size="sm"
              title={`${filter} filtering is not supported by the API yet`}
              type="button"
              variant="outline"
            >
              {filter}
              <ChevronDown aria-hidden="true" />
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load projects and sites</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>Check your connection, then try again.</p>
            <Button
              onClick={() => setRetryCount((count) => count + 1)}
              size="sm"
              type="button"
              variant="outline"
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : !projectSitePage ? (
        <ProjectSiteTableSkeleton />
      ) : projectSitePage.content.length === 0 ? (
        <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Building2 aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-base font-semibold text-foreground">No projects or sites yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Construction-site classifications created for your organization will appear here.
          </p>
        </section>
      ) : (
        <section
          aria-label="Project and site list"
          className="overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1"
        >
          <ProjectSiteTable projectSites={projectSitePage.content} />
          <ProjectSitePagination
            currentPage={projectSitePage.number + 1}
            onPageChange={handlePageChange}
            pageSize={projectSitePage.size}
            totalElements={projectSitePage.totalElements}
            totalPages={projectSitePage.totalPages}
          />
        </section>
      )}

      {createOpen ? (
        <ProjectSiteDialog
          onOpenChange={setCreateOpen}
          onSaved={() => setRetryCount((count) => count + 1)}
          open
        />
      ) : null}
    </div>
  )
}
