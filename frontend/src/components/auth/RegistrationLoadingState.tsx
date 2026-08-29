import { AuthCardLayout } from '@/components/auth/AuthCardLayout'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

export function RegistrationLoadingState() {
  return (
    <AuthCardLayout
      description="Preparing your Docomptia workspace…"
      title="Signing you in"
    >
      <div aria-busy="true" aria-label="Preparing your workspace" className="flex flex-col gap-6">
        <Progress className="h-2" value={65} />

        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        <p className="text-center text-xs leading-4 text-muted-foreground">
          This will only take a moment.
        </p>
      </div>
    </AuthCardLayout>
  )
}
