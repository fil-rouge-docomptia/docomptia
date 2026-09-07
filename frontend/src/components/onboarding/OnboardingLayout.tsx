import type { PropsWithChildren } from 'react'

import { DocomptiaLogo } from '@/components/common/DocomptiaLogo'
import { Card, CardContent } from '@/components/ui/card'

export function OnboardingLayout({ children }: PropsWithChildren) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 md:py-12">
      <div className="flex w-full max-w-[960px] flex-col items-center gap-6">
        <div className="flex min-h-16 items-center justify-center px-4 py-2">
          <DocomptiaLogo className="w-48" />
        </div>

        <Card className="w-full overflow-hidden rounded-xl shadow-elevation-2">
          <CardContent className="p-6 md:p-8">{children}</CardContent>
        </Card>
      </div>
    </main>
  )
}
