import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import { distanceBetween, getCurrentPosition } from '../utils/geo'
import { getStoredLocation, hasLocationAutoRequested, markLocationAutoRequested } from '../utils/location-cache'

const defaultCenter = [-23.55052, -46.633308]
const markerPalette = ['orange', 'blue', 'green', 'gold', 'violet', 'red']

function MapViewportController({ viewportRequest, onBoundsChange, onManualMove, onMapPick }) {
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
  html: '<div class="map-user-pill"><span>Voce esta aqui</span></div>',
  iconSize: [116, 34],
  iconAnchor: [58, 42],
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
  const [sports, setSports] = useState([])
  const [items, setItems] = useState([])
  const [activeSport, setActiveSport] = useState('all')
  const [selectedSlug, setSelectedSlug] = useState('')
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
    const nextLocation = user?.location || getStoredLocation() || null
    if (!nextLocation) return

    setUserPosition(nextLocation)
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
      .sort((left, right) => {
        if (left.distanceKm === null && right.distanceKm === null) {
          return right.voteCount - left.voteCount
        }
        if (left.distanceKm === null) return 1
        if (right.distanceKm === null) return -1
        return left.distanceKm - right.distanceKm
      })
  }, [items, userPosition])

  const selectedPico = useMemo(
    () => itemsWithDistance.find((item) => item.slug === selectedSlug) ?? itemsWithDistance[0] ?? null,
    [itemsWithDistance, selectedSlug],
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
      setStatusMessage(silent ? '' : 'Localizacao atualizada')
    } catch (nextError) {
      setStatusMessage(silent ? '' : nextError.message)
    } finally {
      setLoadingLocation(false)
    }
  }

  return (
    <section className="page-grid">
      <div className="page-column page-column-main">
        <div className="toolbar-card compact-page-header">
          <div className="section-title compact-section-title">
            <div>
              <p className="eyebrow">PicoMap</p>
              <h1>Mapa</h1>
            </div>
            <button className="secondary-button" onClick={focusExactLocation} disabled={loadingLocation}>
              {loadingLocation ? 'Centralizando...' : 'Centralizar'}
            </button>
            <Link className="primary-button small-link-button" to="/novo-pico">
              Marcar novo pico
            </Link>
          </div>
          {statusMessage ? <span className="toolbar-helper-text">{statusMessage}</span> : null}
        </div>

        <div className="toolbar-card">
          <div className="chip-row">
            <button
              className={activeSport === 'all' ? 'chip active' : 'chip'}
              onClick={() => setActiveSport('all')}
            >
              Todos
            </button>
            {sports.map((sport) => (
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
              <strong>Mapa principal</strong>
              <p>{loadingPicos ? 'Atualizando...' : 'Toque para marcar um ponto.'}</p>
            </div>
            <span className="status-pill">{loadingPicos ? 'atualizando picos' : `${items.length} picos`}</span>
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
                onManualMove={() =>
                  setStatusMessage('')
                }
                onMapPick={(location) => {
                  setPickedLocation(location)
                  setStatusMessage('Ponto marcado')
                }}
              />

              {userPosition ? (
                <>
                  <CircleMarker
                    center={[userPosition.latitude, userPosition.longitude]}
                    radius={10}
                    pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.12 }}
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
                    <strong>Criar pico aqui</strong>
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

              {itemsWithDistance.map((item, index) => (
                <Marker
                  key={item.id}
                  position={[item.latitude, item.longitude]}
                  icon={makeMarker(markerPalette[index % markerPalette.length])}
                  zIndexOffset={1200}
                  eventHandlers={{
                    click: () => navigate(`/picos/${item.slug}`),
                  }}
                >
                  <Popup>
                    <strong>{item.name}</strong>
                    <br />
                    {item.sport.name} - {item.voteCount} votos
                    <br />
                    <Link className="text-link" to={`/picos/${item.slug}`}>
                      Abrir perfil do pico
                    </Link>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            <button className="map-fab" onClick={focusExactLocation} disabled={loadingLocation}>
              {loadingLocation ? 'Centralizando...' : 'Centralizar'}
            </button>
          </div>
        </div>

        {pickedLocation ? (
          <div className="side-card spot-sheet">
            <div className="section-title compact-section-title">
              <h2>Novo pico aqui</h2>
            </div>
            <div className="inline-actions wrap-actions">
              <Link
                className="primary-button small-link-button"
                to={`/novo-pico?lat=${pickedLocation.latitude}&lng=${pickedLocation.longitude}`}
              >
                Criar pico aqui
              </Link>
              <button className="secondary-button small-link-button" type="button" onClick={() => setPickedLocation(null)}>
                Limpar ponto
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="page-column rail-column">
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
            <p className="muted-text">Nenhum pico visivel neste recorte.</p>
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
      </aside>
    </section>
  )
}
