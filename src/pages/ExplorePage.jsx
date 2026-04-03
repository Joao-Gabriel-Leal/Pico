import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import { distanceBetween } from '../utils/geo'

const defaultCenter = [-23.55052, -46.633308]
const markerPalette = ['orange', 'blue', 'green', 'gold', 'violet', 'red']

function RecenterMap({ center, zoom }) {
  const map = useMap()

  useEffect(() => {
    if (!center) return
    map.flyTo(center, zoom, { duration: 1 })
  }, [center, map, zoom])

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
  html: '<div class="map-user-marker"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

export default function ExplorePage() {
  const { user, token } = useAuth()
  const [sports, setSports] = useState([])
  const [items, setItems] = useState([])
  const [activeSport, setActiveSport] = useState('all')
  const [selectedSlug, setSelectedSlug] = useState('')
  const [userPosition, setUserPosition] = useState(null)
  const [followLocation, setFollowLocation] = useState(true)
  const [statusMessage, setStatusMessage] = useState(
    'Toque em "Minha localizacao exata" para centralizar o mapa no seu ponto real.',
  )

  useEffect(() => {
    async function loadBootstrap() {
      const payload = await apiRequest('/api/bootstrap', { token })
      setSports(payload.sports)
    }

    loadBootstrap()
  }, [token])

  useEffect(() => {
    async function loadPicos() {
      const search = new URLSearchParams()
      if (activeSport !== 'all') search.set('sportSlug', activeSport)

      const payload = await apiRequest(`/api/picos?${search.toString()}`, { token })
      setItems(payload.items)
      setSelectedSlug((current) => {
        if (payload.items.some((item) => item.slug === current)) return current
        return payload.items[0]?.slug || ''
      })
    }

    loadPicos()
  }, [activeSport, token])

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatusMessage('Seu navegador nao suporta geolocalizacao.')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setStatusMessage('Localizacao capturada. Voce pode recentralizar o mapa a qualquer momento.')
      },
      () => {
        setStatusMessage('Permita a localizacao do navegador para ver sua posicao exata.')
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 15000,
      },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

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
        if (left.distanceKm === null && right.distanceKm === null) return 0
        if (left.distanceKm === null) return 1
        if (right.distanceKm === null) return -1
        return left.distanceKm - right.distanceKm
      })
  }, [items, userPosition])

  const selectedPico = useMemo(
    () => itemsWithDistance.find((item) => item.slug === selectedSlug) ?? itemsWithDistance[0] ?? null,
    [itemsWithDistance, selectedSlug],
  )

  const mapCenter = followLocation
    ? userPosition
      ? [userPosition.latitude, userPosition.longitude]
      : selectedPico
        ? [selectedPico.latitude, selectedPico.longitude]
        : defaultCenter
    : selectedPico
      ? [selectedPico.latitude, selectedPico.longitude]
      : userPosition
        ? [userPosition.latitude, userPosition.longitude]
        : defaultCenter

  function focusExactLocation() {
    if (userPosition) {
      setFollowLocation(true)
      return
    }

    setStatusMessage('Aceite a permissao de localizacao do navegador e tente novamente.')
  }

  return (
    <section className="page-grid">
      <div className="page-column page-column-main">
        <div className="hero-card">
          <div>
            <p className="eyebrow">Explorar picos</p>
            <h1>Mapa leve, rapido e feito para celular.</h1>
            <p className="hero-copy">
              Agora tudo gira em torno da sua localizacao exata. Escolha esportes, abra um pico,
              vote e entre no detalhe quando realmente precisar.
            </p>
          </div>

          <div className="hero-actions">
            <button className="secondary-button" onClick={focusExactLocation}>
              Minha localizacao exata
            </button>
            <Link className="primary-button small-link-button" to="/novo-pico">
              Marcar novo pico
            </Link>
          </div>
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
              <p>{statusMessage}</p>
            </div>
            {user ? <span className="status-pill">logado</span> : <span className="status-pill">visitante</span>}
          </div>

          <div className="leaflet-shell">
            <MapContainer
              center={mapCenter}
              zoom={followLocation && userPosition ? 15 : 12}
              scrollWheelZoom
              className="leaflet-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <RecenterMap center={mapCenter} zoom={followLocation && userPosition ? 15 : 12} />

              {userPosition ? (
                <>
                  <CircleMarker
                    center={[userPosition.latitude, userPosition.longitude]}
                    radius={30}
                    pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.12 }}
                  />
                  <Marker position={[userPosition.latitude, userPosition.longitude]} icon={userIcon}>
                    <Popup>Voce esta aqui.</Popup>
                  </Marker>
                </>
              ) : null}

              {itemsWithDistance.map((item, index) => (
                <Marker
                  key={item.id}
                  position={[item.latitude, item.longitude]}
                  icon={makeMarker(markerPalette[index % markerPalette.length])}
                  eventHandlers={{
                    click: () => {
                      setSelectedSlug(item.slug)
                      setFollowLocation(false)
                    },
                  }}
                >
                  <Popup>
                    <strong>{item.name}</strong>
                    <br />
                    {item.sport.name} - {item.voteCount} votos
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            <button className="map-fab" onClick={focusExactLocation}>
              Minha localizacao exata
            </button>
          </div>
        </div>
      </div>

      <aside className="page-column">
        <div className="side-card">
          <div className="section-title">
            <h2>Pico selecionado</h2>
            <span>{itemsWithDistance.length} picos</span>
          </div>

          {selectedPico ? (
            <div className="spot-sheet">
              {selectedPico.previewPhoto ? (
                <MediaAsset className="image-preview" src={selectedPico.previewPhoto} alt={selectedPico.name} />
              ) : null}
              <span className="pill">{selectedPico.sport.name}</span>
              <h3>{selectedPico.name}</h3>
              <p>{selectedPico.description}</p>

              <div className="stats-stack">
                <article>
                  <span>Condicao</span>
                  <strong>{selectedPico.conditionLabel}</strong>
                </article>
                <article>
                  <span>Midias</span>
                  <strong>{selectedPico.mediaCount}</strong>
                </article>
                <article>
                  <span>Votos</span>
                  <strong>{selectedPico.voteCount}</strong>
                </article>
              </div>

              {selectedPico.activeCampaign ? (
                <div className="mini-card">
                  <strong>Vaquinha ativa</strong>
                  <p>{selectedPico.activeCampaign.title}</p>
                  <span>
                    {selectedPico.activeCampaign.raisedLabel} de {selectedPico.activeCampaign.goalLabel}
                  </span>
                </div>
              ) : null}

              <Link className="primary-button small-link-button full-width" to={`/picos/${selectedPico.slug}`}>
                Abrir perfil do pico
              </Link>
            </div>
          ) : (
            <p className="muted-text">Nenhum pico encontrado com esses filtros.</p>
          )}
        </div>

        <div className="side-card">
          <div className="section-title">
            <h2>Perto de voce</h2>
            <span>lista leve</span>
          </div>

          <div className="list-stack">
            {itemsWithDistance.map((item) => (
              <button
                key={item.id}
                className={item.slug === selectedSlug ? 'list-item active' : 'list-item'}
                onClick={() => {
                  setSelectedSlug(item.slug)
                  setFollowLocation(false)
                }}
              >
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    {item.sport.name}
                    {item.distanceKm !== null ? ` - ${item.distanceKm.toFixed(1)} km` : ''}
                  </p>
                </div>
                <span>{item.voteCount} votos</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </section>
  )
}
