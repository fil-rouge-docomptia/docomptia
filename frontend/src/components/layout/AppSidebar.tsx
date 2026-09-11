import { Bell, CircleHelp, LogOut, Search } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'

import { DocomptiaLogo } from '@/components/common/DocomptiaLogo'
import {
  getNotificationBadgeText,
  getNotificationButtonLabel,
} from '@/components/layout/notification-utils'
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
  notificationUnreadCount: number | null
  onNotificationsOpen: () => void
  onSearchOpen: () => void
  onSignOut: () => void
  role?: RoleCode
}

function isPathActive(currentPath: string, itemPath: string) {
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`)
}

export function AppSidebar({
  identity,
  notificationUnreadCount,
  onNotificationsOpen,
  onSearchOpen,
  onSignOut,
  role,
}: AppSidebarProps) {
  const location = useLocation()
  const { setOpenMobile } = useSidebar()
  const navigationGroups = role ? getNavigationGroups(role) : []
  const notificationLabel = getNotificationButtonLabel(notificationUnreadCount)

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 max-md:sticky max-md:top-0 max-md:z-10 max-md:shrink-0 max-md:bg-sidebar">
        <SidebarMenu className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:flex md:flex-col md:gap-1">
          <SidebarMenuItem className="col-span-2">
            <Link
              aria-label="Go to dashboard"
              className="flex h-14 w-full items-center justify-start rounded-md p-2 outline-none ring-sidebar-ring focus-visible:ring-2 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:!p-1"
              onClick={() => setOpenMobile(false)}
              title="Docomptia"
              to="/"
            >
              <DocomptiaLogo className="w-40 md:w-44 group-data-[collapsible=icon]:hidden" />
              <DocomptiaLogo
                className="hidden w-8 group-data-[collapsible=icon]:block"
                variant="square"
              />
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem className="min-w-0">
            <SidebarMenuButton
              className="h-10 border border-border bg-background px-3 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-2.5"
              onClick={() => {
                setOpenMobile(false)
                onSearchOpen()
              }}
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
              aria-label={notificationLabel}
              className="size-10 justify-center bg-accent p-0 text-accent-foreground md:h-10 md:w-full md:justify-start md:px-3 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-2.5"
              onClick={() => {
                setOpenMobile(false)
                onNotificationsOpen()
              }}
              tooltip="Notifications"
            >
              <Bell className="!size-5" aria-hidden="true" />
              <span className="hidden md:inline">Notifications</span>
            </SidebarMenuButton>
            {notificationUnreadCount && notificationUnreadCount > 0 ? (
              <SidebarMenuBadge className="hidden bg-destructive text-destructive-foreground md:flex group-data-[collapsible=icon]:!hidden">
                {getNotificationBadgeText(notificationUnreadCount)}
              </SidebarMenuBadge>
            ) : null}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="max-md:flex-none max-md:overflow-visible">
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
                  asChild
                  isActive={location.pathname === '/profile'}
                >
                  <Link aria-label="User profile" onClick={() => setOpenMobile(false)} to="/profile">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                      {identity.initials}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{identity.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{identity.email}</span>
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-10 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-2.5"
                  onClick={() => {
                    setOpenMobile(false)
                    onSignOut()
                  }}
                  tooltip="Sign out"
                >
                  <LogOut className="!size-5" aria-hidden="true" />
                  <span>Sign out</span>
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
