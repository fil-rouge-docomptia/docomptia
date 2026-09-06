import { useEffect, useState } from 'react'
import { Activity, AlertCircle, ArrowLeft, FileText, Users } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { ProjectSiteDetailHeader } from '@/components/project/detail/ProjectSiteDetailHeader'
import { ProjectSiteOverviewTab } from '@/components/project/detail/ProjectSiteOverviewTab'
import { ProjectSiteUnavailableTab } from '@/components/project/detail/ProjectSiteUnavailableTab'
import { ProjectSiteDialog } from '@/components/project/ProjectSiteDialog'
import { canManageProjectSites } from '@/components/project/project-site-utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { getProjectSite } from '@/services/project-site'
import type { ProjectSite } from '@/types/project-site'

type ProjectDetailTab = 'activity' | 'invoices' | 'overview' | 'suppliers'

const projectTabs: ProjectDetailTab[] = ['overview', 'invoices', 'suppliers', 'activity']

function parseTab(value: string | null): ProjectDetailTab {
  return projectTabs.includes(value as ProjectDetailTab)
    ? value as ProjectDetailTab
    : 'overview'
}

function ProjectDetailsSkeleton() {
  return (
    <div aria-label="Loading project details" className="space-y-6">
      <div>
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="mt-2 h-5 w-64 max-w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-24" key={index} />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default function ProjectDetailsPage() {
  const { projectId: projectIdParam } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [requestState, setRequestState] = useState<{
    error: boolean
    projectSite: ProjectSite | null
    requestKey: string
  }>({ error: false, projectSite: null, requestKey: '' })
  const [retryCount, setRetryCount] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const projectId = Number(projectIdParam)
  const validProjectId = Number.isInteger(projectId) && projectId > 0
  const requestKey = `${projectIdParam}:${retryCount}`
  const currentRequest = requestState.requestKey === requestKey
  const projectSite = currentRequest ? requestState.projectSite : null
  const error = !validProjectId || (currentRequest && requestState.error)
  const activeTab = parseTab(searchParams.get('tab'))

  useEffect(() => {
    if (!validProjectId) {
      return
    }

    const controller = new AbortController()

    getProjectSite(projectId, controller.signal)
      .then((response) => {
        setRequestState({
          error: response.type !== 'CHANTIER',
          projectSite: response.type === 'CHANTIER' ? response : null,
          requestKey,
        })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setRequestState({ error: true, projectSite: null, requestKey })
        }
      })

    return () => controller.abort()
  }, [projectId, requestKey, validProjectId])

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 pt-6">
        <Button asChild size="sm" variant="ghost">
          <Link to="/projects">
            <ArrowLeft aria-hidden="true" />
            Back to projects & sites
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load project or site</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Check that this construction site exists and try again.</p>
            {validProjectId ? (
              <Button
                onClick={() => setRetryCount((count) => count + 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                Try again
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!projectSite) {
    return <ProjectDetailsSkeleton />
  }

  return (
    <div className="space-y-6">
      <ProjectSiteDetailHeader
        canEdit={canManageProjectSites(user?.permissions)}
        onEdit={() => setEditOpen(true)}
        projectSite={projectSite}
      />

      <Tabs
        onValueChange={(value) => {
          const nextTab = parseTab(value)
          setSearchParams(nextTab === 'overview' ? {} : { tab: nextTab })
        }}
        value={activeTab}
      >
        <TabsList className="grid h-10 w-full max-w-md grid-cols-4 gap-1 bg-transparent p-0">
          {projectTabs.map((tab) => (
            <TabsTrigger
              className="h-10 bg-muted px-3 text-xs capitalize data-[state=active]:border data-[state=active]:border-border"
              key={tab}
              value={tab}
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent className="mt-5" value="overview">
          <ProjectSiteOverviewTab projectSite={projectSite} />
        </TabsContent>
        <TabsContent className="mt-5" value="invoices">
          <ProjectSiteUnavailableTab
            description="The invoice API does not support project filtering yet. No unfiltered invoices are shown here."
            icon={FileText}
            title="Project invoices unavailable"
          />
        </TabsContent>
        <TabsContent className="mt-5" value="suppliers">
          <ProjectSiteUnavailableTab
            description="The API does not expose suppliers linked to a project yet. No unrelated suppliers are shown here."
            icon={Users}
            title="Project suppliers unavailable"
          />
        </TabsContent>
        <TabsContent className="mt-5" value="activity">
          <ProjectSiteUnavailableTab
            description="The API does not expose an activity history for projects and sites yet."
            icon={Activity}
            title="Project activity unavailable"
          />
        </TabsContent>
      </Tabs>

      {editOpen ? (
        <ProjectSiteDialog
          onOpenChange={setEditOpen}
          onSaved={(updatedProjectSite) => {
            setRequestState({
              error: false,
              projectSite: updatedProjectSite,
              requestKey,
            })
          }}
          open
          projectSite={projectSite}
        />
      ) : null}
    </div>
  )
}
