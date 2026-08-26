import { ErrorState } from '@/components/states/ErrorState'

export default function UnauthorizedPage() {
  return (
    <ErrorState
      actionLabel="Return to sign in"
      actionPath="/login"
      code={401}
      description="We could not verify your session. Sign in again to continue."
      title="Session unavailable"
    />
  )
}
