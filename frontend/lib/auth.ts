// Client-side admin token storage.
//
// The token is the backend's admin bearer token (generated on first run and
// printed by install.sh / written to data/admin_token.txt). It is stored in
// localStorage so the single-admin dashboard persists the session across
// reloads. This is appropriate for a self-hosted single-user control plane.

const STORAGE_KEY = "antigravity_admin_token"

export function getToken(): string {
  if (typeof window === "undefined") return ""
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return
  try {
    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
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
