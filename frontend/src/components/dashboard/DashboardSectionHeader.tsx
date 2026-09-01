import type { ReactNode } from 'react'

type DashboardSectionHeaderProps = {
  action?: ReactNode
  description: string
  title: string
  titleId?: string
}

export function DashboardSectionHeader({
  action,
  description,
  title,
  titleId,
}: DashboardSectionHeaderProps) {
  return (
    <header className="mb-4 flex min-h-12 items-center justify-between gap-4">
      <div className="min-w-0">
        <h2
          className="text-xl font-semibold leading-7 tracking-[-0.25px] text-foreground"
          id={titleId}
        >
          {title}
        </h2>
        <p className="text-xs leading-4 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}

export function DashboardSectionAction({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground">
      {children}
    </span>
  )
}
