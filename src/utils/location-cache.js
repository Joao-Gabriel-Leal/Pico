const locationStorageKey = 'picomap_cached_location'
const sessionAutoRequestKey = 'picomap_location_auto_requested'

function canUseStorage(kind) {
  try {
    return typeof window !== 'undefined' && Boolean(window[kind])
  } catch {
    return false
  }
}

export function getStoredLocation() {
  if (!canUseStorage('localStorage')) return null

  try {
    const raw = window.localStorage.getItem(locationStorageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const latitude = Number(parsed?.latitude)
    const longitude = Number(parsed?.longitude)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    if (latitude === 0 && longitude === 0) return null

    return {
      latitude,
      longitude,
      accuracy: Number.isFinite(Number(parsed?.accuracy)) ? Number(parsed.accuracy) : null,
      updatedAt: parsed?.updatedAt || new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function setStoredLocation(location) {
  if (!canUseStorage('localStorage') || !location) return location

  try {
    window.localStorage.setItem(locationStorageKey, JSON.stringify(location))
  } catch {}

  return location
}

export function markLocationAutoRequested() {
  if (!canUseStorage('sessionStorage')) return
  try {
    window.sessionStorage.setItem(sessionAutoRequestKey, '1')
  } catch {}
}

export function hasLocationAutoRequested() {
  if (!canUseStorage('sessionStorage')) return false
  try {
    return window.sessionStorage.getItem(sessionAutoRequestKey) === '1'
  } catch {
    return false
  }
}
