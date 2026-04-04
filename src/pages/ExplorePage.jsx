import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import RouteMapPreview from '../components/RouteMapPreview'
import { distanceBetween, getCurrentPosition } from '../utils/geo'
import {
  getStoredLocation,
  hasLocationAutoRequested,
  markLocationAutoRequested,
} from '../utils/location-cache'
import {
  formatRouteDistance,
  formatRouteDuration,
  getRouteCenter,
  getRouteDistanceFromLocation,
  getRouteSportOptions,
  isRouteWithinBounds,
  listStoredRoutes,
  routeUpdateEvent,
} from '../utils/routes'

const defaultCenter = [-23.55052, -46.633308]
const markerPalette = ['orange', 'blue', 'green', 'gold', 'violet', 'red']

function formatDistance(distanceKm) {
  if (distanceKm === null) return ''
  return `${distanceKm.toFixed(1)} km`
}

function MapViewportController({
  viewportRequest,
  onBoundsChange,
  onManualMove,
  onMapPick,
}) {
  const map = useMap()

  useEffect(() => {
    const bounds = map.getBounds()
    onBoundsChange({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    })
  }, [map, onBoundsChange])

  useEffect(() => {
    if (!viewportRequest?.center) return
    map.flyTo(viewportRequest.center, viewportRequest.zoom, { duration: 0.8 })
  }, [map, viewportRequest])

  useMapEvents({
    click(event) {
      onMapPick({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      })
    },
    dragstart: onManualMove,
    zoomstart: onManualMove,
    moveend() {
      const bounds = map.getBounds()
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      })
    },
  })

  return null
}

function makeMarker(color) {
  return L.divIcon({
    className: '',
    html: `<div class="map-marker map-marker-${color}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

const userIcon = L.divIcon({
  className: '',
  html: '<div class="map-user-pill"><span>Sua crew ta aqui</span></div>',
  iconSize: [140, 34],
  iconAnchor: [70, 42],
})

const createSpotIcon = L.divIcon({
  className: '',
  html: '<div class="map-create-pin">+</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
})

export default function ExplorePage() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const initialLocation = user?.location || getStoredLocation() || null
  const autoLocateRef = useRef(false)
  const hasManualMapMoveRef = useRef(false)
  const [sports, setSports] = useState([])
  const [items, setItems] = useState([])
  const [routes, setRoutes] = useState(() => listStoredRoutes())
  const [layerFilter, setLayerFilter] = useState('all')
  const [activeSport, setActiveSport] = useState('all')
  const [selectedSlug, setSelectedSlug] = useState('')
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [userPosition, setUserPosition] = useState(initialLocation)
  const [pickedLocation, setPickedLocation] = useState(null)
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [loadingPicos, setLoadingPicos] = useState(true)
  const [statusMessage, setStatusMessage] = useState('')
  const [bounds, setBounds] = useState(null)
  const [viewportRequest, setViewportRequest] = useState({
    center: initialLocation ? [initialLocation.latitude, initialLocation.longitude] : defaultCenter,
    zoom: initialLocation ? 15 : 12,
    key: 'initial',
  })

  useEffect(() => {
    function handleRoutesUpdated() {
      setRoutes(listStoredRoutes())
    }

    window.addEventListener(routeUpdateEvent, handleRoutesUpdated)
    return () => window.removeEventListener(routeUpdateEvent, handleRoutesUpdated)
  }, [])

  useEffect(() => {
    const nextLocation = user?.location || getStoredLocation() || null
    if (!nextLocation) return

    setUserPosition(nextLocation)
    if (hasManualMapMoveRef.current) return

    setViewportRequest((current) => {
      if (
        current.center?.[0] === nextLocation.latitude &&
        current.center?.[1] === nextLocation.longitude
      ) {
        return current
      }

      return {
        center: [nextLocation.latitude, nextLocation.longitude],
        zoom: 15,
        key: `cached-${nextLocation.latitude}-${nextLocation.longitude}`,
      }
    })
  }, [user?.location?.latitude, user?.location?.longitude])

  useEffect(() => {
    if (autoLocateRef.current) return
    autoLocateRef.current = true

    if (user?.location || getStoredLocation() || hasLocationAutoRequested()) return

    markLocationAutoRequested()
    focusExactLocation({ silent: true })
  }, [user?.location?.latitude, user?.location?.longitude])

  useEffect(() => {
    async function loadBootstrap() {
      const payload = await apiRequest('/api/bootstrap', { token })
      setSports(payload.sports)
    }

    loadBootstrap()
  }, [token])

  useEffect(() => {
    if (!bounds) return

    async function loadPicos() {
      setLoadingPicos(true)

      try {
        const search = new URLSearchParams()
        if (activeSport !== 'all') search.set('sportSlug', activeSport)
        search.set('north', String(bounds.north))
        search.set('south', String(bounds.south))
        search.set('east', String(bounds.east))
        search.set('west', String(bounds.west))

        const payload = await apiRequest(`/api/picos?${search.toString()}`, { token })
        setItems(payload.items)
        setSelectedSlug((current) => {
          if (payload.items.some((item) => item.slug === current)) return current
          return payload.items[0]?.slug || ''
        })
      } finally {
        setLoadingPicos(false)
      }
    }

    loadPicos()
  }, [activeSport, bounds, token])

  const availableSports = useMemo(() => {
    const baseSports = sports.map((sport) => ({
      id: sport.id,
      slug: sport.slug,
      name: sport.name,
    }))
    const known = new Set(baseSports.map((sport) => sport.slug))

    for (const routeSport of getRouteSportOptions()) {
      if (!known.has(routeSport.slug)) {
        baseSports.push({
          id: `route-${routeSport.slug}`,
          slug: routeSport.slug,
          name: routeSport.name,
        })
      }
    }

    return baseSports
  }, [sports])

  const itemsWithDistance = useMemo(() => {
    return [...items]
      .map((item) => ({
        ...item,
        distanceKm: userPosition
          ? distanceBetween(userPosition, {
              latitude: item.latitude,
              longitude: item.longitude,
            })
          : null,
      }))
      .filter((item) => activeSport === 'all' || item.sport?.slug === activeSport)
      .sort((left, right) => {
        if (left.distanceKm === null && right.distanceKm === null) {
          return right.voteCount - left.voteCount
        }
        if (left.distanceKm === null) return 1
        if (right.distanceKm === null) return -1
        return left.distanceKm - right.distanceKm
      })
  }, [activeSport, items, userPosition])

  const routesInBounds = useMemo(() => {
    return routes
      .filter((route) => isRouteWithinBounds(route, bounds))
      .filter((route) => activeSport === 'all' || route.sport === activeSport)
      .map((route) => ({
        ...route,
        distanceKm: getRouteDistanceFromLocation(route, userPosition),
        center: getRouteCenter(route),
      }))
      .sort((left, right) => {
        if (left.distanceKm === null && right.distanceKm === null) {
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        }
        if (left.distanceKm === null) return 1
        if (right.distanceKm === null) return -1
        return left.distanceKm - right.distanceKm
      })
  }, [activeSport, bounds, routes, userPosition])

  useEffect(() => {
    setSelectedRouteId((current) => {
      if (routesInBounds.some((route) => route.id === current)) return current
      return routesInBounds[0]?.id || ''
    })
  }, [routesInBounds])

  const selectedPico = useMemo(
    () => itemsWithDistance.find((item) => item.slug === selectedSlug) ?? itemsWithDistance[0] ?? null,
    [itemsWithDistance, selectedSlug],
  )

  const selectedRoute = useMemo(
    () => routesInBounds.find((route) => route.id === selectedRouteId) ?? routesInBounds[0] ?? null,
    [routesInBounds, selectedRouteId],
  )

  async function focusExactLocation({ silent = false } = {}) {
    setLoadingLocation(true)
    if (!silent) {
      setStatusMessage('Capturando sua localizacao exata...')
    }

    try {
      const location = await getCurrentPosition()
      setUserPosition(location)
      setViewportRequest({
        center: [location.latitude, location.longitude],
        zoom: 15,
        key: `${location.latitude}-${location.longitude}-${Date.now()}`,
      })
      hasManualMapMoveRef.current = false
      setStatusMessage(silent ? '' : 'Mapa centralizado na sua posicao')
    } catch (nextError) {
      setStatusMessage(silent ? '' : nextError.message)
    } finally {
      setLoadingLocation(false)
    }
  }

  return (
    <section className="page-grid">
      <div className="page-column page-column-main">
        <div className="hero-card map-hero-card">
          <div className="section-title compact-section-title">
            <div>
              <p className="eyebrow">PicoHunter</p>
              <h1>Mapa</h1>
            </div>
            <div className="inline-actions wrap-actions">
              <button className="secondary-button" onClick={() => focusExactLocation()} disabled={loadingLocation}>
                {loadingLocation ? 'Centralizando...' : 'Minha posicao'}
              </button>
              <Link className="secondary-button small-link-button" to="/nova-rota">
                Nova rota
              </Link>
              <Link className="primary-button small-link-button" to="/novo-pico">
                Novo pico
              </Link>
            </div>
          </div>

          <p className="hero-copy">
            Descobre spots fixos, visualiza percursos em linha e explora a cidade no seu ritmo.
          </p>

          {statusMessage ? <span className="toolbar-helper-text">{statusMessage}</span> : null}
        </div>

        <div className="toolbar-card">
          <div className="chip-row">
            <button className={layerFilter === 'all' ? 'chip active' : 'chip'} onClick={() => setLayerFilter('all')}>
              Tudo
            </button>
            <button className={layerFilter === 'picos' ? 'chip active' : 'chip'} onClick={() => setLayerFilter('picos')}>
              Picos
            </button>
            <button className={layerFilter === 'routes' ? 'chip active' : 'chip'} onClick={() => setLayerFilter('routes')}>
              Rotas
            </button>
          </div>
          <div className="chip-row">
            <button className={activeSport === 'all' ? 'chip active' : 'chip'} onClick={() => setActiveSport('all')}>
              Todos esportes
            </button>
            {availableSports.map((sport) => (
              <button
                key={sport.id}
                className={activeSport === sport.slug ? 'chip active' : 'chip'}
                onClick={() => setActiveSport(sport.slug)}
              >
                {sport.name}
              </button>
            ))}
          </div>
        </div>

        <div className="map-card">
          <div className="map-card-header">
            <div>
              <strong>Exploracao livre</strong>
              <p>
                Arraste, aproxime e descubra. O mapa respeita seu movimento sem voltar sozinho.
              </p>
            </div>
            <span className="status-pill">
              {itemsWithDistance.length} picos • {routesInBounds.length} rotas
            </span>
          </div>

          <div className="leaflet-shell">
            <MapContainer
              center={viewportRequest.center}
              zoom={viewportRequest.zoom}
              scrollWheelZoom
              className="leaflet-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapViewportController
                viewportRequest={viewportRequest}
                onBoundsChange={setBounds}
                onManualMove={() => {
                  hasManualMapMoveRef.current = true
                  setStatusMessage('')
                }}
                onMapPick={(location) => {
                  setPickedLocation(location)
                  setStatusMessage('Ponto novo marcado no mapa.')
                }}
              />

              {userPosition ? (
                <>
                  <CircleMarker
                    center={[userPosition.latitude, userPosition.longitude]}
                    radius={10}
                    pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.16 }}
                    interactive={false}
                  />
                  <Marker
                    position={[userPosition.latitude, userPosition.longitude]}
                    icon={userIcon}
                    interactive={false}
                    zIndexOffset={100}
                  />
                </>
              ) : null}

              {pickedLocation ? (
                <Marker
                  position={[pickedLocation.latitude, pickedLocation.longitude]}
                  icon={createSpotIcon}
                  zIndexOffset={900}
                >
                  <Popup>
                    <strong>Marcar novo pico aqui</strong>
                    <br />
                    <Link
                      className="text-link"
                      to={`/novo-pico?lat=${pickedLocation.latitude}&lng=${pickedLocation.longitude}`}
                    >
                      Abrir criacao neste ponto
                    </Link>
                  </Popup>
                </Marker>
              ) : null}

              {layerFilter !== 'routes'
                ? itemsWithDistance.map((item, index) => (
                    <Marker
                      key={item.id}
                      position={[item.latitude, item.longitude]}
                      icon={makeMarker(markerPalette[index % markerPalette.length])}
                      zIndexOffset={1200}
                      eventHandlers={{
                        click: () => {
                          setSelectedSlug(item.slug)
                        },
                      }}
                    >
                      <Popup>
                        <strong>{item.name}</strong>
                        <br />
                        {item.sport.name} • {item.voteCount} votos
                        <br />
                        <Link className="text-link" to={`/picos/${item.slug}`}>
                          Abrir pico
                        </Link>
                      </Popup>
                    </Marker>
                  ))
                : null}

              {layerFilter !== 'picos'
                ? routesInBounds.map((route) => (
                    <Polyline
                      key={route.id}
                      positions={route.points.map((point) => [point.latitude, point.longitude])}
                      pathOptions={{
                        color: route.sportMeta?.color,
                        weight: route.id === selectedRoute?.id ? 7 : 5,
                        opacity: route.id === selectedRoute?.id ? 1 : 0.74,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                      eventHandlers={{
                        click: () => {
                          setSelectedRouteId(route.id)
                        },
                      }}
                    />
                  ))
                : null}
            </MapContainer>

            <button className="map-fab" onClick={() => focusExactLocation()} disabled={loadingLocation}>
              {loadingLocation ? 'Centralizando...' : 'Centralizar'}
            </button>
          </div>
        </div>

        {pickedLocation ? (
          <div className="side-card spot-sheet">
            <div className="section-title compact-section-title">
              <h2>Novo pico nesse ponto</h2>
            </div>
            <div className="inline-actions wrap-actions">
              <Link
                className="primary-button small-link-button"
                to={`/novo-pico?lat=${pickedLocation.latitude}&lng=${pickedLocation.longitude}`}
              >
                Criar pico aqui
              </Link>
              <button className="secondary-button small-link-button" type="button" onClick={() => setPickedLocation(null)}>
                Limpar marcador
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="page-column rail-column">
        {layerFilter !== 'routes' ? (
          <div className="side-card sticky-card">
            <div className="section-title compact-section-title">
              <h2>Picos na area</h2>
              <span>{itemsWithDistance.length}</span>
            </div>

            {selectedPico ? (
              <article className="mini-card pico-preview-card">
                <MediaAsset
                  className="cover-thumb small-cover-thumb"
                  src={selectedPico.previewPhoto || selectedPico.coverImageUrl}
                  alt={selectedPico.name}
                  expandable
                />
                <div className="mini-card-body">
                  <strong>{selectedPico.name}</strong>
                  <p>{selectedPico.description}</p>
                  <div className="meta-row">
                    <span>{selectedPico.sport.name}</span>
                    <span>{selectedPico.voteCount} votos</span>
                    {selectedPico.distanceKm !== null ? <span>{selectedPico.distanceKm.toFixed(1)} km</span> : null}
                  </div>
                  <Link className="primary-button small-link-button full-width" to={`/picos/${selectedPico.slug}`}>
                    Abrir perfil do pico
                  </Link>
                </div>
              </article>
            ) : (
              <p className="muted-text">Nenhum pico visivel nesse recorte.</p>
            )}

            <div className="section-divider" />

            <div className="list-stack compact-list">
              {itemsWithDistance.map((item) => (
                <button
                  key={item.id}
                  className={item.slug === selectedSlug ? 'list-item active' : 'list-item'}
                  onClick={() => {
                    setSelectedSlug(item.slug)
                    setViewportRequest({
                      center: [item.latitude, item.longitude],
                      zoom: 15,
                      key: `${item.slug}-${Date.now()}`,
                    })
                  }}
                >
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.sport.name}</p>
                  </div>
                  <span>{item.distanceKm !== null ? `${item.distanceKm.toFixed(1)} km` : `${item.voteCount} votos`}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {layerFilter !== 'picos' ? (
          <div className="side-card sticky-card route-rail-card">
            <div className="section-title compact-section-title">
              <h2>Rotas urbanas</h2>
              <span>{routesInBounds.length}</span>
            </div>

            {selectedRoute ? (
              <article className="route-rail-preview">
                <RouteMapPreview points={selectedRoute.points} color={selectedRoute.sportMeta?.color} />
                <div className="mini-card-body">
                  <strong>{selectedRoute.name}</strong>
                  <p>{selectedRoute.description || 'Percurso street salvo pela comunidade do PicoHunter.'}</p>
                  <div className="meta-row">
                    <span>{selectedRoute.sportMeta?.name}</span>
                    <span>{selectedRoute.distanceKm !== null ? `${selectedRoute.distanceKm.toFixed(1)} km` : 'sem distancia'}</span>
                    <span>{formatRouteDuration(selectedRoute.estimatedMinutes)}</span>
                  </div>
                  <Link className="primary-button small-link-button full-width" to={`/rotas/${selectedRoute.id}`}>
                    Abrir rota
                  </Link>
                </div>
              </article>
            ) : (
              <p className="muted-text">Ainda nao existe rota salva nesse recorte.</p>
            )}

            <div className="section-divider" />

            <div className="list-stack compact-list">
              {routesInBounds.map((route) => (
                <button
                  key={route.id}
                  className={route.id === selectedRouteId ? 'list-item active' : 'list-item'}
                  onClick={() => {
                    setSelectedRouteId(route.id)
                    if (route.center) {
                      setViewportRequest({
                        center: [route.center.latitude, route.center.longitude],
                        zoom: 14,
                        key: `${route.id}-${Date.now()}`,
                      })
                    }
                  }}
                >
                  <div>
                    <strong>{route.name}</strong>
                    <p>{route.sportMeta?.name}</p>
                  </div>
                  <span>{route.distanceKm !== null ? `${route.distanceKm.toFixed(1)} km` : 'sem distancia'}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </section>
  )
}
