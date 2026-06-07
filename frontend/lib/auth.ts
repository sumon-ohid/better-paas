// Client-side admin token storage.
//
// The token is the backend's admin bearer token (generated on first run and
// written to data/admin_token.txt). Keep it in sessionStorage so a future XSS
// bug would have less time to harvest a long-lived credential.

const STORAGE_KEY = "better-paas_admin_token"

export function getToken(): string {
  if (typeof window === "undefined") return ""
  try {
    const token = window.sessionStorage.getItem(STORAGE_KEY)
    if (token) return token

    // Migrate older installs away from persistent localStorage.
    const legacy = window.localStorage.getItem(STORAGE_KEY)
    if (legacy) {
      window.sessionStorage.setItem(STORAGE_KEY, legacy)
      window.localStorage.removeItem(STORAGE_KEY)
      return legacy
    }
    return ""
  } catch {
    return ""
  }
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return
  try {
    if (token) {
      window.sessionStorage.setItem(STORAGE_KEY, token)
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

export function clearToken(): void {
  setToken("")
}

export function hasToken(): boolean {
  return getToken().length > 0
}
