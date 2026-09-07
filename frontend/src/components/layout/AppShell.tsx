import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Bell, Menu, Search } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { DocomptiaLogo } from '@/components/common/DocomptiaLogo'
import { GlobalSearchDialog } from '@/components/layout/GlobalSearchDialog'
import { AppSidebar, type ShellIdentity } from '@/components/layout/AppSidebar'
import { NotificationSheet } from '@/components/layout/NotificationSheet'
import {
  getNotificationBadgeText,
  getNotificationButtonLabel,
} from '@/components/layout/notification-utils'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { useAuth } from '@/hooks/use-auth'
import { useNotificationCenter } from '@/hooks/use-notification-center'
import type { CurrentUser } from '@/types/auth'

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function toShellIdentity(user: CurrentUser): ShellIdentity {
  const name = `${user.firstName} ${user.lastName}`.trim() || user.email
  const organization = user.organization.name || user.organization.legalName

  return {
    email: user.email,
    initials: getInitials(name),
    name,
    organization,
    organizationInitials: getInitials(organization),
  }
}

type GlobalHeaderProps = {
  notificationUnreadCount: number | null
  onNotificationsOpen: () => void
  onSearchOpen: () => void
}

function GlobalHeader({
  notificationUnreadCount,
  onNotificationsOpen,
  onSearchOpen,
}: GlobalHeaderProps) {
  const { toggleSidebar } = useSidebar()
  const notificationLabel = getNotificationButtonLabel(notificationUnreadCount)

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6 xl:px-8">
      <div className="flex items-center gap-4">
        <Button
          aria-label="Open navigation"
          className="h-11 bg-accent px-3 text-accent-foreground hover:bg-accent/80 md:h-10 md:px-4 xl:hidden"
          onClick={toggleSidebar}
          type="button"
          variant="ghost"
        >
          <Menu className="size-5" aria-hidden="true" />
          <span className="hidden md:inline">Menu</span>
        </Button>

        <Button
          className="hidden h-10 w-[276px] justify-start border-border font-medium xl:inline-flex"
          onClick={onSearchOpen}
          type="button"
          variant="outline"
        >
          <span className="min-w-0 flex-1 truncate text-left text-muted-foreground">
            Search…
          </span>
          <Search className="size-4 shrink-0" aria-hidden="true" />
        </Button>

        <Button
          aria-label="Search"
          className="size-11 bg-accent text-accent-foreground hover:bg-accent/80 md:size-10 xl:hidden"
          onClick={onSearchOpen}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Search className="size-5" aria-hidden="true" />
        </Button>
      </div>

      <DocomptiaLogo className="absolute left-1/2 top-1/2 w-28 -translate-x-1/2 -translate-y-1/2 md:hidden" />

      <div className="relative">
        <Button
          aria-label={notificationLabel}
          className="size-11 bg-accent text-accent-foreground hover:bg-accent/80 md:size-10"
          onClick={onNotificationsOpen}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Bell className="size-5" aria-hidden="true" />
        </Button>
        {notificationUnreadCount && notificationUnreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground"
          >
            {getNotificationBadgeText(notificationUnreadCount)}
          </span>
        ) : null}
      </div>
    </header>
  )
}

export function AppShell() {
  const { signOut, user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1280)
  const [searchOpen, setSearchOpen] = useState(false)
  const notificationCenter = useNotificationCenter()
  const identity = user ? toShellIdentity(user) : undefined

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1280px)')
    const syncSidebar = (event: MediaQueryListEvent | MediaQueryList) => setSidebarOpen(event.matches)

    syncSidebar(desktopQuery)
    desktopQuery.addEventListener('change', syncSidebar)
    return () => desktopQuery.removeEventListener('change', syncSidebar)
  }, [])

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }

    window.addEventListener('keydown', openSearch)
    return () => window.removeEventListener('keydown', openSearch)
  }, [])

  return (
    <SidebarProvider
      onOpenChange={setSidebarOpen}
      open={sidebarOpen}
      style={
        {
          '--sidebar-width': '17rem',
          '--sidebar-width-icon': '4.5rem',
        } as CSSProperties
      }
    >
      <AppSidebar
        identity={identity}
        notificationUnreadCount={notificationCenter.unreadCount}
        onNotificationsOpen={() => notificationCenter.setOpen(true)}
        onSearchOpen={() => setSearchOpen(true)}
        onSignOut={signOut}
        role={user?.role.code}
      />
      <SidebarInset className="min-w-0">
        <GlobalHeader
          notificationUnreadCount={notificationCenter.unreadCount}
          onNotificationsOpen={() => notificationCenter.setOpen(true)}
          onSearchOpen={() => setSearchOpen(true)}
        />
        <main className="min-w-0 flex-1 bg-background p-4 md:p-6 xl:p-8">
          <Outlet />
        </main>
      </SidebarInset>
      <GlobalSearchDialog onOpenChange={setSearchOpen} open={searchOpen} />
      <NotificationSheet
        loadError={notificationCenter.loadError}
        notifications={notificationCenter.notifications}
        onMarkAsRead={notificationCenter.markAsRead}
        onOpenChange={notificationCenter.setOpen}
        onRetry={notificationCenter.retry}
        open={notificationCenter.open}
        pendingReadIds={notificationCenter.pendingReadIds}
        totalNotifications={notificationCenter.totalNotifications}
      />
    </SidebarProvider>
  )
}
