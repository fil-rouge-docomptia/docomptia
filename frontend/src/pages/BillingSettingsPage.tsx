import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'

import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { SubscriptionOverview } from '@/components/settings/SubscriptionOverview'
import { SubscriptionPlans } from '@/components/settings/SubscriptionPlans'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/services/api'
import { getCurrentSubscription, getSubscriptionPlans, type CurrentSubscription, type SubscriptionPlan } from '@/services/subscription'

type Result<T> = { attempt: number, data: T } | { attempt: number, error: unknown }
const description = 'Review your organization’s plan, subscription and usage.'

function BillingError({ error, label, onRetry }: { error: unknown, label: string, onRetry: () => void }) {
  const denied = error instanceof ApiError && error.status === 403
  return <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{denied ? `${label} access denied` : `${label} unavailable`}</AlertTitle><AlertDescription className="space-y-3"><p>{denied ? 'You do not have permission to view this information.' : 'This information could not be loaded. Please try again.'}</p><Button onClick={onRetry} variant="outline">Retry {label.toLowerCase()}</Button></AlertDescription></Alert>
}

function BillingSettings() {
  const [attempt, setAttempt] = useState(0)
  const [planAttempt, setPlanAttempt] = useState(0)
  const [subscriptionResult, setSubscriptionResult] = useState<Result<CurrentSubscription> | null>(null)
  const [plansResult, setPlansResult] = useState<Result<SubscriptionPlan[]> | null>(null)
  const subscription = subscriptionResult?.attempt === attempt ? subscriptionResult : null
  const plans = plansResult?.attempt === planAttempt ? plansResult : null
  useEffect(() => {
    const controller = new AbortController()
    getCurrentSubscription(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setSubscriptionResult({ attempt, data }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setSubscriptionResult({ attempt, error }) })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    const controller = new AbortController()
    getSubscriptionPlans(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setPlansResult({ attempt: planAttempt, data }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setPlansResult({ attempt: planAttempt, error }) })
    return () => controller.abort()
  }, [planAttempt])
  const currentCode = subscription && 'data' in subscription ? subscription.data.plan?.code ?? null : null
  return <SettingsLayout actions={<Button onClick={() => { setAttempt((n) => n + 1); setPlanAttempt((n) => n + 1) }} variant="outline">Refresh billing</Button>} description={description} section="billing">
    <section aria-labelledby="plans-heading" className="space-y-4">
      <h3 className="text-lg font-semibold" id="plans-heading">Plans</h3>
      <p className="text-xs text-muted-foreground">Available plans and the capacity included in each offer.</p>
      <p className="rounded-lg bg-info-muted p-4 text-xs" id="billing-actions-unavailable">Plans are shown for reference. Plan changes and payments are not available from this screen.</p>
      {!plans ? <div aria-busy="true" aria-label="Loading plans" role="status"><Skeleton className="h-64" /></div> : 'error' in plans ? <BillingError error={plans.error} label="Plans" onRetry={() => setPlanAttempt((n) => n + 1)} /> : <SubscriptionPlans currentCode={currentCode} plans={plans.data} />}
    </section>
    {!subscription ? <div aria-busy="true" aria-label="Loading subscription" className="space-y-4" role="status"><Skeleton className="h-44" /><Skeleton className="h-28" /></div> : 'error' in subscription ? <BillingError error={subscription.error} label="Subscription" onRetry={() => setAttempt((n) => n + 1)} /> : <SubscriptionOverview subscription={subscription.data} />}
    <section aria-labelledby="payment-heading" className="space-y-4">
      <h3 className="text-lg font-semibold" id="payment-heading">Payment</h3>
      <p className="text-xs text-muted-foreground">Payment method and billing information.</p>
      <div className="grid gap-4 sm:grid-cols-2">{[{ title: 'Payment method', description: 'Payment details are not available.', action: 'Update payment method' }, { title: 'Billing information', description: 'Subscription billing details are not available.', action: 'Edit billing information' }].map(({ title, description, action }) => <div className="space-y-3 rounded-lg border p-4" key={title}><h4 className="text-xs font-medium">{title}</h4><p className="text-xs text-muted-foreground">{description}</p><Button className="min-h-11 whitespace-normal" disabled variant="outline">{action}</Button></div>)}</div>
    </section>
    <section aria-labelledby="billing-history-heading" className="space-y-4">
      <h3 className="text-lg font-semibold" id="billing-history-heading">Billing history</h3>
      <div className="space-y-2 rounded-lg border border-dashed p-6"><p className="text-sm font-medium">Billing history unavailable</p><p className="text-xs text-muted-foreground">Subscription payments and invoice downloads are not available yet.</p></div>
    </section>
  </SettingsLayout>
}

export default function BillingSettingsPage() {
  const { user } = useAuth()
  if (user?.role.code !== 'ADMIN') return <SettingsLayout description={description} section="billing"><Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Billing access denied</AlertTitle><AlertDescription>Only administrators can view the organization’s subscription.</AlertDescription></Alert></SettingsLayout>
  return <BillingSettings key={`${user.id}:${user.organization.id}:${user.role.code}`} />
}
