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

export type NavigationItem = {
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
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: Inbox, label: 'Inbox', path: '/inbox' },
      { icon: ReceiptText, label: 'Invoices', path: '/invoices' },
      { icon: BadgeCheck, label: 'Approvals', path: '/approvals' },
      { icon: Calculator, label: 'Accounting', path: '/accounting' },
      { icon: FileOutput, label: 'Exports', path: '/exports' },
      { icon: Files, label: 'Documents', path: '/documents' },
    ],
  },
  {
    label: 'Directory',
    items: [
      { icon: Truck, label: 'Suppliers', path: '/suppliers' },
      { icon: Users, label: 'Clients', path: '/clients' },
      { icon: MapPin, label: 'Projects / Sites', path: '/projects' },
    ],
  },
  {
    label: 'Analytics',
    items: [{ icon: ChartNoAxesColumn, label: 'Reports', path: '/reports' }],
  },
  {
    label: 'Administration',
    items: [
      { icon: Plug, label: 'Integrations', path: '/integrations' },
      { icon: Settings, label: 'Settings', path: '/settings' },
    ],
  },
]
