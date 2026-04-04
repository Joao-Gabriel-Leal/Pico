import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { apiRequest } from './api'
import { distanceBetween, getPreferredLocation, watchCurrentPosition } from './utils/geo'

const AuthContext = createContext(null)
const storageKey = 'picomap_token'
const legacyStorageKey = 'picoliga_token'
const locationSyncDebounceMs = 2500
const locationSyncMinDistanceKm = 0.03
const locationSyncMinIntervalMs = 45000

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey) || '')
  const [user, setUser] = useState(null)
  const [liveLocation, setLiveLocation] = useState(() => getPreferredLocation())
  const [loading, setLoading] = useState(true)
  const latestUserRef = useRef(null)
  const latestTokenRef = useRef(token)
  const latestLiveLocationRef = useRef(liveLocation)
  const locationSyncTimeoutRef = useRef(null)
  const stopLocationWatchRef = useRef(null)
  const lastSyncedLocationRef = useRef({
    location: null,
    timestamp: 0,
  })

  function applyLiveLocation(userValue) {
    if (!userValue) return userValue

    const preferredLocation = getPreferredLocation(userValue.location, latestLiveLocationRef.current)
    if (!preferredLocation) return userValue

    return {
      ...userValue,
      location: preferredLocation,
    }
  }

  async function flushLocationSync(nextLocation) {
    const currentUser = latestUserRef.current
    const currentToken = latestTokenRef.current

    if (!currentUser || !currentToken) return
    if (!currentUser.displayName || !currentUser.favoriteSportIds?.length) return

    const lastSync = lastSyncedLocationRef.current
    const distanceKm = lastSync.location ? distanceBetween(lastSync.location, nextLocation) : null
    const elapsedMs = Date.now() - Number(lastSync.timestamp || 0)

    if (
      lastSync.location &&
      distanceKm !== null &&
      distanceKm < locationSyncMinDistanceKm &&
      elapsedMs < locationSyncMinIntervalMs
    ) {
      return
    }

    try {
      const payload = await apiRequest('/api/me', {
        method: 'PUT',
        token: currentToken,
        body: {
          displayName: currentUser.displayName,
          bio: currentUser.bio || '',
          avatarUrl: currentUser.avatarUrl || '',
          favoriteSportIds: currentUser.favoriteSportIds || [],
          location: nextLocation,
        },
      })

      const syncedUser = applyLiveLocation(payload.user)
      latestUserRef.current = syncedUser
      setUser(syncedUser)
      lastSyncedLocationRef.current = {
        location: nextLocation,
        timestamp: Date.now(),
      }
    } catch {}
  }

  function scheduleLocationSync(nextLocation) {
    if (locationSyncTimeoutRef.current) {
      clearTimeout(locationSyncTimeoutRef.current)
    }

    locationSyncTimeoutRef.current = setTimeout(() => {
      locationSyncTimeoutRef.current = null
      flushLocationSync(nextLocation)
    }, locationSyncDebounceMs)
  }

  useEffect(() => {
    latestUserRef.current = user
  }, [user])

  useEffect(() => {
    latestTokenRef.current = token
  }, [token])

  useEffect(() => {
    latestLiveLocationRef.current = liveLocation
  }, [liveLocation])

  useEffect(() => {
    async function bootstrapAuth() {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const payload = await apiRequest('/api/me', { token })
        const nextUser = applyLiveLocation(payload.user)
        if (nextUser?.location) {
          setLiveLocation(nextUser.location)
        }
        setUser(nextUser)
        if (nextUser?.location) {
          lastSyncedLocationRef.current = {
            location: nextUser.location,
            timestamp: Date.now(),
          }
        }
      } catch {
        localStorage.removeItem(storageKey)
        localStorage.removeItem(legacyStorageKey)
        setToken('')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    bootstrapAuth()
  }, [token])

  useEffect(() => {
    if (stopLocationWatchRef.current) return

    stopLocationWatchRef.current = watchCurrentPosition({
      onChange(nextLocation) {
        setLiveLocation(nextLocation)
        latestUserRef.current = latestUserRef.current
          ? {
              ...latestUserRef.current,
              location: nextLocation,
            }
          : latestUserRef.current

        setUser((current) =>
          current
            ? {
                ...current,
                location: nextLocation,
              }
            : current,
        )
        scheduleLocationSync(nextLocation)
      },
    })

    return () => {
      if (stopLocationWatchRef.current) {
        stopLocationWatchRef.current()
        stopLocationWatchRef.current = null
      }

      if (locationSyncTimeoutRef.current) {
        clearTimeout(locationSyncTimeoutRef.current)
        locationSyncTimeoutRef.current = null
      }
    }
  }, [])

  function persist(tokenValue, userValue) {
    localStorage.setItem(storageKey, tokenValue)
    localStorage.removeItem(legacyStorageKey)
    setToken(tokenValue)
    const nextUser = applyLiveLocation(userValue)
    if (nextUser?.location) {
      setLiveLocation(nextUser.location)
    }
    setUser(nextUser)
    if (nextUser?.location) {
      lastSyncedLocationRef.current = {
        location: nextUser.location,
        timestamp: Date.now(),
      }
    }
  }

  async function login(form) {
    const payload = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: form,
    })
    persist(payload.token, payload.user)
    return payload.user
  }

  async function register(form) {
    const payload = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: form,
    })
    persist(payload.token, payload.user)
    return payload.user
  }

  async function refreshUser() {
    if (!token) return null
    const payload = await apiRequest('/api/me', { token })
    const nextUser = applyLiveLocation(payload.user)
    if (nextUser?.location) {
      setLiveLocation(nextUser.location)
    }
    setUser(nextUser)
    if (nextUser?.location) {
      lastSyncedLocationRef.current = {
        location: nextUser.location,
        timestamp: Date.now(),
      }
    }
    return nextUser
  }

  function logout() {
    localStorage.removeItem(storageKey)
    localStorage.removeItem(legacyStorageKey)
    setToken('')
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        liveLocation,
        loading,
        login,
        register,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
