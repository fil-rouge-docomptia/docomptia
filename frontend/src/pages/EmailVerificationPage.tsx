import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { AuthCardLayout } from '@/components/auth/AuthCardLayout'
import { RegistrationLoadingState } from '@/components/auth/RegistrationLoadingState'
import { VerificationCodeInput } from '@/components/auth/VerificationCodeInput'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import {
  clearPendingRegistrationEmail,
  getPendingRegistrationEmail,
} from '@/lib/registration-session'
import {
  MOCK_EXPIRED_VERIFICATION_CODE,
  MOCK_VALID_VERIFICATION_CODE,
  MockEmailVerificationError,
  resendEmailWithMock,
  verifyEmailWithMock,
} from '@/services/email-verification'
import type { LoginCredentials } from '@/types/auth'

type VerificationState = 'idle' | 'invalid' | 'expired' | 'loading'

type VerificationLocationState = {
  email?: string
  credentials?: LoginCredentials
}

function waitForLoadingState() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 1000))
}

export default function EmailVerificationPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const routeState = location.state as VerificationLocationState | null
  const email =
    routeState?.email ??
    getPendingRegistrationEmail() ??
    (import.meta.env.DEV ? 'name@company.com' : null)
  const [code, setCode] = useState('')
  const [verificationState, setVerificationState] = useState<VerificationState>('idle')
  const [isResending, setIsResending] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  if (!email) {
    return <Navigate replace to="/register" />
  }

  if (verificationState === 'loading') {
    return <RegistrationLoadingState />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (code.length !== 6) {
      setVerificationState('invalid')
      return
    }

    try {
      await verifyEmailWithMock(code)
      setVerificationState('loading')
      await waitForLoadingState()

      if (routeState?.credentials) {
        await signIn(routeState.credentials)
        clearPendingRegistrationEmail()
        navigate('/dashboard', { replace: true })
        return
      }

      clearPendingRegistrationEmail()
      navigate('/login', {
        replace: true,
        state: { registrationComplete: true },
      })
    } catch (error) {
      if (error instanceof MockEmailVerificationError) {
        setVerificationState(error.reason)
        if (error.reason === 'expired') {
          setCode('')
        }
        return
      }

      setVerificationState('invalid')
    }
  }

  async function handleResend() {
    setIsResending(true)
    await resendEmailWithMock()
    setCode('')
    setVerificationState('idle')
    setAnnouncement(`A new mock code is ready. Use ${MOCK_VALID_VERIFICATION_CODE}.`)
    setIsResending(false)
  }

  if (verificationState === 'expired') {
    return (
      <AuthCardLayout
        description="Request a new code to continue."
        title="Verification code expired"
      >
        <div className="flex flex-col gap-6">
          <Alert className="border-warning/30 bg-warning-muted text-warning-muted-foreground">
            <CircleAlert aria-hidden="true" className="size-4 text-warning" />
            <AlertTitle>Code expired</AlertTitle>
            <AlertDescription>This verification code is no longer valid.</AlertDescription>
          </Alert>

          <VerificationCodeInput disabled onChange={setCode} value={code} />

          <Button className="h-11 md:h-10" disabled={isResending} onClick={handleResend}>
            {isResending ? (
              <>
                <LoaderCircle aria-hidden="true" className="animate-spin" />
                Sending…
              </>
            ) : (
              'Send a new code'
            )}
          </Button>
          <Button className="h-11 md:h-10" onClick={() => navigate('/register')} variant="outline">
            Back
          </Button>
        </div>
      </AuthCardLayout>
    )
  }

  const isInvalid = verificationState === 'invalid'

  return (
    <AuthCardLayout
      description={
        <>
          We sent a 6-digit verification code to{' '}
          <span className="font-medium text-foreground">{email}</span>.
        </>
      }
      title="Check your email"
    >
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        {isInvalid ? (
          <Alert className="border-destructive/30 bg-destructive/5" variant="destructive">
            <CircleAlert aria-hidden="true" className="size-4" />
            <AlertTitle>Invalid verification code</AlertTitle>
            <AlertDescription>Check the code and try again.</AlertDescription>
          </Alert>
        ) : null}

        <VerificationCodeInput
          invalid={isInvalid}
          onChange={(nextCode) => {
            setCode(nextCode)
            if (isInvalid) {
              setVerificationState('idle')
            }
          }}
          value={code}
        />

        <p className="text-center text-xs leading-4 text-muted-foreground">
          Mock codes: <span className="font-medium text-foreground">{MOCK_VALID_VERIFICATION_CODE}</span>{' '}
          is valid and{' '}
          <span className="font-medium text-foreground">{MOCK_EXPIRED_VERIFICATION_CODE}</span> is expired.
        </p>

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <Button className="h-11 md:h-10" type="submit">
          Verify email
        </Button>
        <Button
          className="h-11 md:h-10"
          disabled={isResending}
          onClick={handleResend}
          type="button"
          variant="outline"
        >
          {isResending ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" />
              Resending…
            </>
          ) : (
            'Resend code'
          )}
        </Button>

        {!isInvalid ? (
          <Button
            className="h-8 text-muted-foreground"
            onClick={() => navigate('/register')}
            type="button"
            variant="ghost"
          >
            Use a different email
          </Button>
        ) : null}
      </form>
    </AuthCardLayout>
  )
}
