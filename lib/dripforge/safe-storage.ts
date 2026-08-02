/** Sichere Storage-Helfer für Incognito / In-App-Browser (Storage kann werfen). */

export function safeLocalGet(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeLocalSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function safeSessionGet(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSessionSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false
  try {
    window.sessionStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
