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
import { hasPermission } from '@/lib/permissions'
import type { PermissionCode } from '@/types/auth'

export type NavigationItem = {
  permission: PermissionCode
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
        permission: 'dashboard.read',
        icon: LayoutDashboard,
        label: 'Dashboard',
        path: '/dashboard',
      },
      { permission: 'invoice.upload', icon: Inbox, label: 'Inbox', path: '/inbox' },
      { permission: 'invoice.read', icon: ReceiptText, label: 'Invoices', path: '/invoices' },
      {
        permission: 'invoice.approve',
        icon: BadgeCheck,
        label: 'Approvals',
        path: '/approvals',
      },
      { permission: 'accounting-configuration.read', icon: Calculator, label: 'Accounting', path: '/accounting' },
      { permission: 'invoice.read', icon: FileOutput, label: 'Exports', path: '/exports' },
      { permission: 'invoice.read', icon: Files, label: 'Documents', path: '/documents' },
    ],
  },
  {
    label: 'Directory',
    items: [
      { permission: 'supplier.read', icon: Truck, label: 'Suppliers', path: '/suppliers' },
      { permission: 'organization.read', icon: Users, label: 'Clients', path: '/clients' },
      { permission: 'classification.read', icon: MapPin, label: 'Projects / Sites', path: '/projects' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { permission: 'dashboard.read', icon: ChartNoAxesColumn, label: 'Reports', path: '/reports' },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        permission: 'organization.manage',
        icon: Plug,
        label: 'Integrations',
        path: '/integrations',
      },
      {
        permission: 'organization.manage',
        icon: Settings,
        label: 'Settings',
        path: '/settings',
      },
    ],
  },
]

export function getNavigationGroups(permissions: readonly string[]) {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasPermission(permissions, item.permission)),
    }))
    .filter((group) => group.items.length > 0)
}
