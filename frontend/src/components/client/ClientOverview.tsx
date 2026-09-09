import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatClientDate } from '@/components/client/client-utils'
import type { Customer } from '@/types/customer'

export function ClientOverview({ customer }: { customer: Customer }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {['Active projects', 'Invoice volume', 'Recorded revenue'].map((label) => (
          <Card aria-label={label} className="min-w-0 shadow-elevation-1" key={label}>
            <CardContent className="p-4">
              <h2 className="text-sm font-normal text-muted-foreground">{label}</h2>
              <p className="mt-2 text-3xl font-semibold" aria-label="Not available">—</p>
              <p className="mt-2 text-xs text-muted-foreground">Not available yet</p>
            </CardContent>
          </Card>
        ))}
        <Card className="min-w-0 shadow-elevation-1">
          <CardContent className="p-4">
            <h2 className="text-sm font-normal text-muted-foreground">Last updated</h2>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{formatClientDate(customer.updatedAt)}</p>
            <p className="mt-2 text-xs text-muted-foreground">Client profile</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,704fr)_minmax(0,384fr)]">
        <Card className="shadow-elevation-1">
          <CardHeader className="p-4 pb-6">
            <h2 className="text-xl font-semibold tracking-[-0.25px]">Recent activity</h2>
            <p className="text-xs text-muted-foreground">Auditable changes for this client.</p>
          </CardHeader>
          <CardContent className="space-y-6 px-4 pb-6">
            <p className="text-sm text-muted-foreground">The client activity history is not available yet.</p>
            <dl className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Profile created</dt><dd className="mt-2 text-sm">{formatClientDate(customer.createdAt)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Profile last updated</dt><dd className="mt-2 text-sm">{formatClientDate(customer.updatedAt)}</dd></div>
            </dl>
            <p className="text-xs text-muted-foreground">Profile timestamps do not constitute an activity log.</p>
          </CardContent>
        </Card>
        <Card className="shadow-elevation-1">
          <CardHeader className="p-4 pb-6">
            <h2 className="text-xl font-semibold tracking-[-0.25px]">Active projects</h2>
            <p className="text-xs text-muted-foreground">Projects and sites linked to this client.</p>
          </CardHeader>
          <CardContent className="px-4 pb-6">
            <p className="text-sm text-muted-foreground">Client project links are not available yet.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
