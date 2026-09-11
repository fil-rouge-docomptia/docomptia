import { Check } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { subscriptionFeature, subscriptionLimit, type SubscriptionPlan } from '@/services/subscription'

export function SubscriptionPlans({ plans, currentCode }: { plans: SubscriptionPlan[], currentCode: string | null }) {
  if (!plans.length) return <p className="rounded-lg border border-dashed p-6 text-sm" role="status">No plans are available.</p>
  return <div className="grid gap-4 xl:grid-cols-3">
    {plans.map((plan) => <article aria-label={`${plan.name} plan`} className="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-6" key={plan.code}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="break-words text-lg font-semibold">{plan.name}</h4>{plan.code === currentCode && <Badge className="bg-success-muted text-success" variant="secondary">Current plan</Badge>}</div>
      <p className="text-xs text-muted-foreground">Pricing is not available.</p>
      <Separator />
      <ul className="flex-1 space-y-2 text-xs">
        <li>{subscriptionLimit(plan.monthlyInvoiceLimit)} invoices / month</li>
        <li>{subscriptionLimit(plan.maxActiveUsers)} active users</li>
        {plan.features.map((feature) => <li className="flex items-start gap-2 break-words" key={feature}><Check aria-hidden="true" className="size-3 shrink-0" /><span className="min-w-0">{subscriptionFeature(feature)}</span></li>)}
      </ul>
      <Button aria-describedby="billing-actions-unavailable" className="min-h-11 whitespace-normal" disabled variant="outline">{plan.code === currentCode ? 'Current plan' : `Choose ${plan.name}`}</Button>
    </article>)}
  </div>
}
