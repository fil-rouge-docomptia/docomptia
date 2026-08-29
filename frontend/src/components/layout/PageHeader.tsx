import type { ReactNode } from 'react'

type PageHeaderProps = {
  actions?: ReactNode
  description: string
  title: string
}

export function PageHeader({ actions, description, title }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-[-0.75px] text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </header>
  )
}
