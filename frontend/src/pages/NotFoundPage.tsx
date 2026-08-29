import { ErrorState } from '@/components/states/ErrorState'

export default function NotFoundPage() {
  return (
    <ErrorState
      actionLabel="Back to dashboard"
      actionPath="/dashboard"
      code={404}
      description="The page you requested does not exist or has been moved."
      title="Page not found"
    />
  )
}
