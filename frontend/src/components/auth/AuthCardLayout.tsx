import type { PropsWithChildren, ReactNode } from 'react'

import { DocomptiaLogo } from '@/components/common/DocomptiaLogo'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type AuthCardLayoutProps = PropsWithChildren<{
  title: string
  description: ReactNode
  className?: string
}>

export function AuthCardLayout({
  title,
  description,
  className,
  children,
}: AuthCardLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 md:py-12">
      <div className={cn('flex w-full max-w-[440px] flex-col items-center gap-6', className)}>
        <div className="flex min-h-16 items-center justify-center px-4 py-2">
          <DocomptiaLogo className="w-48" />
        </div>

        <Card className="w-full overflow-hidden rounded-xl shadow-elevation-2">
          <CardHeader className="space-y-2 p-6 pb-0 md:p-8 md:pb-0">
            <h1 className="text-2xl font-semibold leading-8 tracking-[-0.5px]">{title}</h1>
            <CardDescription className="leading-5">{description}</CardDescription>
          </CardHeader>

          <CardContent className="p-6 md:p-8 md:pt-6">{children}</CardContent>
        </Card>
      </div>
    </main>
  )
}
