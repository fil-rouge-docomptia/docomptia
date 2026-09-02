import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

type ProjectSiteUnavailableTabProps = {
  description: string
  icon: LucideIcon
  title: string
}

export function ProjectSiteUnavailableTab({
  description,
  icon: Icon,
  title,
}: ProjectSiteUnavailableTabProps) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
