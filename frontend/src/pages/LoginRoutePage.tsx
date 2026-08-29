import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Location } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/use-auth'

const LOGIN_ERROR_MESSAGE = 'Unable to sign in. Check your credentials and try again.'
const ssoProviders = ['Google', 'Microsoft', 'Apple']

export default function LoginRoutePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const requestedLocation = (location.state as { from?: Location } | null)?.from
  const redirectPath = requestedLocation
    ? `${requestedLocation.pathname}${requestedLocation.search}${requestedLocation.hash}`
    : '/dashboard'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)

    try {
      await signIn({
        email: String(formData.get('email')).trim(),
        password: String(formData.get('password')),
      })

      navigate(redirectPath, { replace: true })
    } catch {
      setErrorMessage(LOGIN_ERROR_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-6">
        <p className="text-xl font-semibold leading-7 tracking-[-0.25px] text-foreground">
          Docomptia
        </p>

        <Card className="w-full overflow-hidden rounded-xl shadow-elevation-2">
          <CardHeader className="space-y-2 p-6 pb-0 md:p-8 md:pb-0">
            <h1 className="text-2xl font-semibold leading-8 tracking-[-0.5px]">
              Welcome to Docomptia
            </h1>
            <CardDescription className="min-h-10 leading-5">
              Manage your invoices from document to accounting.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 md:p-8 md:pt-6">
            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="email">
                  Work email
                </Label>
                <Input
                  aria-describedby={errorMessage ? 'login-error' : undefined}
                  autoComplete="username"
                  className="h-11 md:h-9"
                  disabled={isSubmitting}
                  id="email"
                  name="email"
                  placeholder="name@company.com"
                  required
                  type="email"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="password">
                  Password
                </Label>
                <Input
                  aria-describedby={errorMessage ? 'login-error' : undefined}
                  autoComplete="current-password"
                  className="h-11 md:h-9"
                  disabled={isSubmitting}
                  id="password"
                  name="password"
                  required
                  type="password"
                />
              </div>

              {errorMessage ? (
                <Alert className="border-destructive/30 bg-destructive/5" variant="destructive">
                  <CircleAlert aria-hidden="true" className="size-4" />
                  <AlertDescription id="login-error">{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <Button className="h-11 md:h-10" disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <>
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Continue'
                )}
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs leading-4 text-muted-foreground">or continue with</span>
                <Separator className="flex-1" />
              </div>

              {ssoProviders.map((provider) => (
                <Button
                  className="h-11 disabled:opacity-100 md:h-10"
                  disabled
                  key={provider}
                  title={`${provider} sign-in is not available yet`}
                  type="button"
                  variant="outline"
                >
                  Continue with {provider}
                </Button>
              ))}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
