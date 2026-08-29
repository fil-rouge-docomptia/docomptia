const AUTH_TOKEN_STORAGE_KEY = 'docomptia.authToken'
const AUTH_SESSION_CHANGE_EVENT = 'docomptia:auth-session-change'

export function getAuthToken() {
  return sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
}

export function setAuthToken(token: string) {
  sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGE_EVENT))
}

export function clearAuthToken() {
  sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGE_EVENT))
}

export function subscribeToAuthSession(listener: () => void) {
  window.addEventListener(AUTH_SESSION_CHANGE_EVENT, listener)
  return () => window.removeEventListener(AUTH_SESSION_CHANGE_EVENT, listener)
}
