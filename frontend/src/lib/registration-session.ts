const PENDING_REGISTRATION_EMAIL_KEY = 'docomptia.pending-registration-email'

export function getPendingRegistrationEmail(): string | null {
  return window.sessionStorage.getItem(PENDING_REGISTRATION_EMAIL_KEY)
}

export function setPendingRegistrationEmail(email: string) {
  window.sessionStorage.setItem(PENDING_REGISTRATION_EMAIL_KEY, email)
}

export function clearPendingRegistrationEmail() {
  window.sessionStorage.removeItem(PENDING_REGISTRATION_EMAIL_KEY)
}
