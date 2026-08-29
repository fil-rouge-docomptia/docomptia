import { FileQuestion, LogIn, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

type ErrorStateProps = {
  actionLabel: string
  actionPath: string
  code: 401 | 403 | 404
  description: string
  title: string
}

export function ErrorState({
  actionLabel,
  actionPath,
  code,
  description,
  title,
}: ErrorStateProps) {
  const Icon = code === 401 ? LogIn : code === 403 ? ShieldAlert : FileQuestion

  return (
    <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px] rounded-xl border bg-card p-6 text-center shadow-elevation-2 sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.1px] text-muted-foreground">
          Error {code}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.5px] text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
        <Button asChild className="mt-6 w-full">
          <Link to={actionPath}>{actionLabel}</Link>
        </Button>
      </div>
    </section>
  )
}
