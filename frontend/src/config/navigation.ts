import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  Calculator,
  ChartNoAxesColumn,
  FileOutput,
  Files,
  Inbox,
  LayoutDashboard,
  MapPin,
  Plug,
  ReceiptText,
  Settings,
  Truck,
  Users,
} from 'lucide-react'
import type { RoleCode } from '@/types/auth'

const allRoles: RoleCode[] = ['ADMIN', 'OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']
const processingRoles: RoleCode[] = ['ADMIN', 'OPERATEUR_COMPTABLE']
const validationRoles: RoleCode[] = ['ADMIN', 'RESPONSABLE_COMPTABLE']
const administrationRoles: RoleCode[] = ['ADMIN']

export type NavigationItem = {
  allowedRoles: RoleCode[]
  icon: LucideIcon
  label: string
  path: string
}

export type NavigationGroup = {
  items: NavigationItem[]
  label: string
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: 'Workspace',
    items: [
      {
        allowedRoles: allRoles,
        icon: LayoutDashboard,
        label: 'Dashboard',
        path: '/dashboard',
      },
      { allowedRoles: processingRoles, icon: Inbox, label: 'Inbox', path: '/inbox' },
      { allowedRoles: allRoles, icon: ReceiptText, label: 'Invoices', path: '/invoices' },
      {
        allowedRoles: validationRoles,
        icon: BadgeCheck,
        label: 'Approvals',
        path: '/approvals',
      },
      { allowedRoles: allRoles, icon: Calculator, label: 'Accounting', path: '/accounting' },
      { allowedRoles: allRoles, icon: FileOutput, label: 'Exports', path: '/exports' },
      { allowedRoles: allRoles, icon: Files, label: 'Documents', path: '/documents' },
    ],
  },
  {
    label: 'Directory',
    items: [
      { allowedRoles: allRoles, icon: Truck, label: 'Suppliers', path: '/suppliers' },
      { allowedRoles: allRoles, icon: Users, label: 'Clients', path: '/clients' },
      { allowedRoles: allRoles, icon: MapPin, label: 'Projects / Sites', path: '/projects' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { allowedRoles: allRoles, icon: ChartNoAxesColumn, label: 'Reports', path: '/reports' },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        allowedRoles: administrationRoles,
        icon: Plug,
        label: 'Integrations',
        path: '/integrations',
      },
      {
        allowedRoles: administrationRoles,
        icon: Settings,
        label: 'Settings',
        path: '/settings',
      },
    ],
  },
]

export function getNavigationGroups(role: RoleCode) {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.allowedRoles.includes(role)),
    }))
    .filter((group) => group.items.length > 0)
}
