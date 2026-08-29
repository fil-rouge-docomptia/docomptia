import { ErrorState } from '@/components/states/ErrorState'

export default function ForbiddenPage() {
  return (
    <ErrorState
      actionLabel="Back to dashboard"
      actionPath="/dashboard"
      code={403}
      description="You do not have permission to access this content."
      title="Access denied"
    />
  )
}
