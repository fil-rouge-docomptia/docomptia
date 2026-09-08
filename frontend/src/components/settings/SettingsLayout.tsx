import type { ReactNode } from 'react'
import { ArrowLeft, ChevronRight, FolderTree, Settings, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

const sections = [
  { id: 'general', title: 'General', icon: Settings },
  { id: 'categories', title: 'Categories', icon: FolderTree },
  { id: 'members', title: 'Members', icon: Users },
] as const

type SettingsLayoutProps = {
  section: typeof sections[number]['id']
  description: string
  overview?: boolean
  actions?: ReactNode
  children: ReactNode
}

export function SettingsLayout({ section, description, overview = false, actions, children }: SettingsLayoutProps) {
  const { user } = useAuth()
  return (
    <div className="space-y-6 px-2 md:px-0">
      <PageHeader description={description} title="Settings" />
      <div className="grid gap-8 lg:grid-cols-[224px_minmax(0,1fr)]">
        <nav aria-label="Settings categories" className={cn('min-w-0 space-y-4', !overview && 'hidden lg:block')}>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-[-0.25px]"><span className="lg:hidden">Settings categories</span><span className="hidden lg:inline">Settings</span></h2>
            <p className="text-xs text-muted-foreground">Workspace preferences and administration.</p>
          </div>
          <div className="space-y-1">
            {sections.filter(({ id }) => id !== 'members' || user?.role.code === 'ADMIN').map(({ id, title, icon: Icon }) => (
              <Link aria-current={!overview && section === id ? 'page' : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring lg:min-h-10', section === id && 'bg-accent text-accent-foreground')} key={id} to={`/settings/${id}`}>
                <Icon aria-hidden="true" className="size-5 shrink-0" />{title}
                <ChevronRight aria-hidden="true" className="ml-auto size-4 lg:hidden" />
              </Link>
            ))}
          </div>
        </nav>
        <div className={cn('min-w-0 space-y-6', overview && 'hidden lg:block')}>
          <Button asChild className="h-11 bg-accent text-accent-foreground hover:bg-accent/80 lg:hidden" variant="ghost"><Link to="/settings"><ArrowLeft aria-hidden="true" />All settings</Link></Button>
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-[-0.25px]">{sections.find(({ id }) => id === section)?.title}</h2>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            {actions}
          </header>
          {children}
        </div>
      </div>
    </div>
  )
}
