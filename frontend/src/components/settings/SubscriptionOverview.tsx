import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { subscriptionDate, subscriptionLimit, type CurrentSubscription } from '@/services/subscription'

function UsageCard({ title, used, limit }: { title: string, used: number, limit: number | null }) {
  const reached = limit !== null && used >= limit
  return <div className="min-w-0 space-y-3 rounded-lg border p-4">
    <h4 className="text-xs font-medium">{title}</h4>
    <p className="text-sm font-medium tabular-nums">{subscriptionLimit(used)} / {subscriptionLimit(limit)}</p>
    {limit !== null && limit > 0 && <Progress aria-label={`${title} usage`} className="h-2" getValueLabel={() => `${used} of ${limit}`} value={Math.min(100, used / limit * 100)} />}
    {reached && <p className="text-xs text-destructive">{used > limit ? 'Limit exceeded' : 'Limit reached'}</p>}
  </div>
}

export function SubscriptionOverview({ subscription }: { subscription: CurrentSubscription }) {
  return <>
    <section aria-labelledby="subscription-heading" className="space-y-4">
      <h3 className="text-lg font-semibold" id="subscription-heading">Subscription</h3>
      <p className="text-xs text-muted-foreground">Your current plan and renewal details.</p>
      {subscription.subscribed ? <div className="space-y-4 rounded-lg border p-4">
        <dl className="divide-y text-xs [&>div]:flex [&>div]:flex-wrap [&>div]:justify-between [&>div]:gap-2 [&>div]:py-3 [&>div:first-child]:pt-0">
          <div><dt className="text-muted-foreground">Current plan</dt><dd className="break-words font-medium">{subscription.plan.name}</dd></div>
          <div><dt className="text-muted-foreground">Subscription status</dt><dd><Badge variant="secondary">{subscription.status}</Badge></dd></div>
          <div><dt className="text-muted-foreground">Next billing date</dt><dd>{subscription.nextBillingDate ? subscriptionDate(subscription.nextBillingDate) : 'Not provided'}</dd></div>
          <div><dt className="text-muted-foreground">Billing cycle</dt><dd>Not available</dd></div>
        </dl>
        <Button aria-describedby="billing-actions-unavailable" className="min-h-11" disabled variant="outline">Manage subscription</Button>
      </div> : <div className="rounded-lg border border-dashed p-6 text-sm" role="status">No current subscription. No plan or usage has been provided for this organization.</div>}
    </section>
    <section aria-labelledby="usage-heading" className="space-y-4">
      <h3 className="text-lg font-semibold" id="usage-heading">Usage</h3>
      {subscription.subscribed ? <>
        <p className="text-xs text-muted-foreground">Invoices created from {subscriptionDate(subscription.usage.periodStart)} to {subscriptionDate(subscription.usage.periodEnd)}. Users reflect the current active membership.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <UsageCard limit={subscription.plan.monthlyInvoiceLimit} title="Invoices" used={subscription.usage.monthlyInvoices} />
          <UsageCard limit={subscription.plan.maxActiveUsers} title="Users" used={subscription.usage.activeUsers} />
          <div className="space-y-3 rounded-lg border p-4"><h4 className="text-xs font-medium">Storage</h4><p className="text-xs text-muted-foreground">Storage usage and limits are not available.</p></div>
        </div>
      </> : <p className="text-sm text-muted-foreground">Usage is unavailable without a current subscription.</p>}
    </section>
  </>
}
