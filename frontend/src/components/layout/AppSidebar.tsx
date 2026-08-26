import { Bell, CircleHelp, Search } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { getNavigationGroups } from '@/config/navigation'
import type { RoleCode } from '@/types/auth'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

export type ShellIdentity = {
  email: string
  initials: string
  name: string
  organization: string
  organizationInitials: string
}

type AppSidebarProps = {
  identity?: ShellIdentity
  role?: RoleCode
}

function isPathActive(currentPath: string, itemPath: string) {
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`)
}

export function AppSidebar({ identity, role }: AppSidebarProps) {
  const location = useLocation()
  const { setOpenMobile } = useSidebar()
  const navigationGroups = role ? getNavigationGroups(role) : []

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-10 !p-0 group-data-[collapsible=icon]:!size-10"
              size="lg"
              tooltip="Docomptia"
            >
              <Badge className="h-6 min-w-6 justify-center border-0 px-2 font-medium">D</Badge>
              <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">
                Docomptia
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-10 border border-border bg-background px-3 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-2.5"
              tooltip="Search"
            >
              <Search className="!size-5" aria-hidden="true" />
              <span>Search…</span>
              <kbd className="ml-auto rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                ⌘ K
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-10 bg-accent text-accent-foreground group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-2.5"
              tooltip="Notifications"
            >
              <Bell className="!size-5" aria-hidden="true" />
              <span>Notifications</span>
            </SidebarMenuButton>
            <SidebarMenuBadge className="bg-destructive text-destructive-foreground">3</SidebarMenuBadge>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navigationGroups.map((group) => (
          <SidebarGroup className="px-4 py-1 group-data-[collapsible=icon]:px-4" key={group.label}>
            <SidebarGroupLabel className="px-0 uppercase">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isPathActive(location.pathname, item.path)
                  const Icon = item.icon

                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        className="h-10 px-3 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-2.5"
                        isActive={active}
                        tooltip={item.label}
                      >
                        <NavLink onClick={() => setOpenMobile(false)} to={item.path}>
                          <Icon className="!size-5" aria-hidden="true" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-2 p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-10 px-3 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-2.5"
              tooltip="Help"
            >
              <CircleHelp className="!size-5" aria-hidden="true" />
              <span>Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <Separator />

        {identity ? (
          <>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-14 px-2 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-1.5"
                  size="lg"
                  tooltip={identity.organization}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {identity.organizationInitials}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{identity.organization}</span>
                    <span className="text-xs text-muted-foreground">Workspace</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-14 px-2 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-1.5"
                  size="lg"
                  tooltip={identity.name}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {identity.initials}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{identity.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{identity.email}</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        ) : (
          <div aria-label="Loading user context" className="space-y-3 px-2 py-1">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1 group-data-[collapsible=icon]:hidden" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1 group-data-[collapsible=icon]:hidden" />
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
