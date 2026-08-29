export const MOCK_VALID_VERIFICATION_CODE = '123456'
export const MOCK_EXPIRED_VERIFICATION_CODE = '000000'

export type MockVerificationFailure = 'invalid' | 'expired'

export class MockEmailVerificationError extends Error {
  readonly reason: MockVerificationFailure

  constructor(reason: MockVerificationFailure) {
    super(`Mock email verification failed: ${reason}`)
    this.name = 'MockEmailVerificationError'
    this.reason = reason
  }
}

function wait(duration: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration))
}

export async function verifyEmailWithMock(code: string): Promise<void> {
  await wait(500)

  if (code === MOCK_EXPIRED_VERIFICATION_CODE) {
    throw new MockEmailVerificationError('expired')
  }

  if (code !== MOCK_VALID_VERIFICATION_CODE) {
    throw new MockEmailVerificationError('invalid')
  }
}

export async function resendEmailWithMock(): Promise<void> {
  await wait(350)
}
