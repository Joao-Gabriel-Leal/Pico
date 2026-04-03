export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Seu navegador nao suporta geolocalizacao.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          updatedAt: new Date().toISOString(),
        })
      },
      () => reject(new Error('Nao foi possivel capturar sua localizacao exata.')),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      },
    )
  })
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
