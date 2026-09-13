import { Info } from 'lucide-react'
import { Link } from 'react-router-dom'

import { IntegrationsAccess } from '@/components/integrations/IntegrationsAccess'
import { integrationGroups } from '@/components/integrations/integration-options'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function IntegrationsPage() {
  return <IntegrationsAccess>
    <div className="space-y-6 px-2 md:px-0">
      <PageHeader title="Integrations" description="Explore connections and tools for your organization." />
      <Alert className="border-0 bg-info-muted" role="note">
        <Info aria-hidden="true" />
        <AlertTitle>External connections are not available yet</AlertTitle>
        <AlertDescription>
          The options below do not represent active connections. You can still use the export center for accounting exports.
        </AlertDescription>
      </Alert>
      <div className="space-y-6">
        {integrationGroups.map((group, index) => <section aria-labelledby={`integration-group-${index}`} className="space-y-3" key={group.title}>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-[-0.25px]" id={`integration-group-${index}`}>{group.title}</h2>
            <p className="text-xs text-muted-foreground">{group.description}</p>
          </div>
          <div className={`grid gap-4 sm:grid-cols-2 ${group.options.length === 4 ? 'xl:grid-cols-4' : ''}`}>
            {group.options.map((option) => <Card className="flex min-h-[204px] min-w-0 flex-col items-start gap-3 p-5" key={option.id}>
              <h3 className="text-lg font-semibold">{option.name}</h3>
              <p className="flex-1 text-xs leading-4 text-muted-foreground">{option.description}</p>
              <Badge variant="secondary">{option.id === 'accounting-exports' ? 'File exports' : 'Unavailable'}</Badge>
              <Button asChild className="min-h-11" variant="outline">
                <Link aria-label={`View ${option.name} details`} to={`/integrations/${option.id}`}>View details</Link>
              </Button>
            </Card>)}
          </div>
        </section>)}
      </div>
    </div>
  </IntegrationsAccess>
}
