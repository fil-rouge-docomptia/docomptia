import { ArrowLeft, Info } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { IntegrationsAccess } from '@/components/integrations/IntegrationsAccess'
import { integrationOptions } from '@/components/integrations/integration-options'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function IntegrationDetailsPage() {
  const { integrationId } = useParams()
  const option = integrationOptions.find(({ id }) => id === integrationId)
  const exports = option?.id === 'accounting-exports'

  return <IntegrationsAccess>
    <div className="space-y-5 px-2 md:px-0">
      <Button asChild className="min-h-11" variant="ghost">
        <Link to="/integrations"><ArrowLeft aria-hidden="true" />All integrations</Link>
      </Button>
      <PageHeader title={option?.name ?? 'Integration not found'} description={option?.description ?? 'This integration option is not recognized. Return to the integrations overview.'} />
      {option && <>
        <Alert className="border-0 bg-info-muted" role="note">
          <Info aria-hidden="true" />
          <AlertTitle>{exports ? 'Accounting exports' : 'Connection unavailable'}</AlertTitle>
          <AlertDescription id="integration-unavailable">
            {exports ? 'Accounting exports are available from the export center. This does not establish a connection to external software.' : 'Configuration and connection testing are not available yet. No credentials can be entered or saved here.'}
          </AlertDescription>
        </Alert>
        {exports ? <Button asChild className="min-h-11"><Link to="/exports">Open export center</Link></Button> : <>
          <div aria-label="Connection actions" className="flex flex-wrap gap-2 sm:justify-end" role="group">
            <Button aria-describedby="integration-unavailable" className="min-h-11" disabled>Configure</Button>
            <Button aria-describedby="integration-unavailable" className="min-h-11" disabled variant="outline">Test connection</Button>
            <Button aria-describedby="integration-unavailable" className="min-h-11" disabled variant="destructive">Disconnect</Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              <Card className="space-y-4 rounded-xl p-6">
                <h2 className="text-sm font-medium">Configuration</h2>
                <p className="text-sm text-muted-foreground">Configuration details are not available.</p>
              </Card>
              <Card className="space-y-4 rounded-xl p-6">
                <h2 className="text-sm font-medium">Last synchronization</h2>
                <p className="text-sm text-muted-foreground">Synchronization information is not available.</p>
              </Card>
            </div>
            <Card className="space-y-4 rounded-xl p-6">
              <h2 className="text-lg font-semibold">Connection status</h2>
              <Badge variant="secondary">Unavailable</Badge>
              <p className="text-xs text-muted-foreground">No connection status or test result is available to display.</p>
            </Card>
          </div>
          <section aria-labelledby="integration-activity" className="space-y-3">
            <h2 className="text-xl font-semibold tracking-[-0.25px]" id="integration-activity">Recent activity</h2>
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Connection history is not available.</div>
          </section>
        </>}
      </>}
    </div>
  </IntegrationsAccess>
}
