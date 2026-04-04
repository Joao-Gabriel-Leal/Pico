import { getStoredLocation, setStoredLocation } from './location-cache'

function buildLocation(coords) {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    updatedAt: new Date().toISOString(),
  }
}

export function getCurrentPosition({ force = false } = {}) {
  const cachedLocation = force ? null : getStoredLocation()
  if (cachedLocation) {
    return Promise.resolve(cachedLocation)
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Seu navegador nao suporta geolocalizacao.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = buildLocation(position.coords)
        setStoredLocation(location)
        resolve(location)
      },
      () => reject(new Error('Nao foi possivel capturar sua localizacao exata.')),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: force ? 0 : 300000,
      },
    )
  })
}

export function watchCurrentPosition({ onChange, onError, maximumAge = 15000 } = {}) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError?.(new Error('Seu navegador nao suporta geolocalizacao.'))
    return null
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const location = buildLocation(position.coords)
      setStoredLocation(location)
      onChange?.(location)
    },
    () => onError?.(new Error('Nao foi possivel acompanhar sua localizacao em tempo real.')),
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge,
    },
  )

  return () => navigator.geolocation.clearWatch(watchId)
}

function getLocationTimestamp(location) {
  const parsed = Date.parse(location?.updatedAt || '')
  return Number.isFinite(parsed) ? parsed : 0
}

export function getPreferredLocation(...locations) {
  const validLocations = [getStoredLocation(), ...locations].filter(
    (location) =>
      location &&
      Number.isFinite(Number(location.latitude)) &&
      Number.isFinite(Number(location.longitude)),
  )

  if (!validLocations.length) return null

  return [...validLocations].sort((left, right) => getLocationTimestamp(right) - getLocationTimestamp(left))[0]
}

export function formatLocation(location) {
  if (!location) return 'Localizacao ainda nao capturada'
  const accuracy = location.accuracy ? `Precisao de ${Math.round(location.accuracy)} m` : 'Localizacao confirmada'
  return `${accuracy} atualizada`
}

export function distanceBetween(origin, target) {
  if (!origin || !target) return null

  const toRad = (value) => (value * Math.PI) / 180
  const earthRadius = 6371
  const deltaLat = toRad(target.latitude - origin.latitude)
  const deltaLng = toRad(target.longitude - origin.longitude)
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRad(origin.latitude)) *
      Math.cos(toRad(target.latitude)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2)

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
