import { Badge } from '@/components/ui/badge'
import type { AccountingRule } from '@/types/onboarding'

export function RuleStatus({ active }: { active: boolean }) {
  return (
    <Badge className={active ? 'border-success/20 bg-success-muted text-success' : ''} variant="outline">
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}

export function RulePriority({ rule }: { rule: AccountingRule }) {
  return <Badge variant="outline">{rule.priority == null ? 'Priority unavailable' : `Priority ${rule.priority}`}</Badge>
}
