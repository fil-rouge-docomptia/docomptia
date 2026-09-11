import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'

export type SubscriptionPlan = {
  code: string
  name: string
  maxActiveUsers: number | null
  monthlyInvoiceLimit: number | null
  features: string[]
}
export type CurrentSubscription = {
  subscribed: false, status: null, nextBillingDate: null, plan: null, usage: null
} | {
  subscribed: true
  status: string
  nextBillingDate: string | null
  plan: SubscriptionPlan
  usage: { periodStart: string, periodEnd: string, activeUsers: number, monthlyInvoices: number }
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const date = (value: unknown): value is string => typeof value === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value

function parsePlan(value: unknown): SubscriptionPlan {
  if (!record(value) || !text(value.code) || !text(value.name)
    || (value.maxActiveUsers !== null && !count(value.maxActiveUsers))
    || (value.monthlyInvoiceLimit !== null && !count(value.monthlyInvoiceLimit))
    || !Array.isArray(value.features) || !value.features.every(text)) throw new Error('Invalid subscription plan')
  return { code: value.code, name: value.name, maxActiveUsers: value.maxActiveUsers, monthlyInvoiceLimit: value.monthlyInvoiceLimit, features: [...new Set(value.features)] }
}

export async function getSubscriptionPlans(signal: AbortSignal): Promise<SubscriptionPlan[]> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/subscription-plans`, { signal })
  const value: unknown = await response.json()
  if (!Array.isArray(value)) throw new Error('Invalid subscription catalogue')
  const plans = value.map(parsePlan)
  if (new Set(plans.map(({ code }) => code)).size !== plans.length) throw new Error('Duplicate subscription plans')
  return plans
}

export async function getCurrentSubscription(signal: AbortSignal): Promise<CurrentSubscription> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/organizations/current/subscription`, { signal })
  const value: unknown = await response.json()
  if (!record(value)) throw new Error('Invalid subscription')
  if (value.subscribed === false && ['status', 'nextBillingDate', 'plan', 'usage'].every((key) => value[key] === null)) {
    return { subscribed: false, status: null, nextBillingDate: null, plan: null, usage: null }
  }
  if (value.subscribed !== true || !text(value.status) || (value.nextBillingDate !== null && !date(value.nextBillingDate))
    || !record(value.usage) || !date(value.usage.periodStart) || !date(value.usage.periodEnd)
    || value.usage.periodStart > value.usage.periodEnd || !count(value.usage.activeUsers) || !count(value.usage.monthlyInvoices)) throw new Error('Invalid subscription')
  return {
    subscribed: true, status: value.status, nextBillingDate: value.nextBillingDate, plan: parsePlan(value.plan),
    usage: { periodStart: value.usage.periodStart, periodEnd: value.usage.periodEnd, activeUsers: value.usage.activeUsers, monthlyInvoices: value.usage.monthlyInvoices },
  }
}

export function subscriptionDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value))
}

export function subscriptionLimit(value: number | null) {
  return value === null ? 'Unlimited' : new Intl.NumberFormat('en-GB').format(value)
}

const featureNames: Record<string, string> = {
  INVOICE_MANAGEMENT: 'Invoice management', OCR: 'OCR', ACCOUNTING_EXPORT: 'Accounting export',
  APPROVAL_WORKFLOW: 'Approval workflow', AUDIT_LOG: 'Audit log', API_ACCESS: 'API access', ADVANCED_CONNECTORS: 'Advanced connectors',
}
export function subscriptionFeature(value: string) {
  return Object.hasOwn(featureNames, value) ? featureNames[value] : value
}
