import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import { distanceBetween, getCurrentPosition, getPreferredLocation } from '../utils/geo'
import { uploadSelectedFile } from '../utils/files'
import {
  createRouteAuthorSnapshot,
  createRouteRecord,
  estimateRouteDurationMinutes,
  formatRouteDistance,
  formatRouteDuration,
  getRouteDifficultyOptions,
  getRouteDistanceKm,
  getRouteSport,
  getRouteSportOptions,
  saveRouteRecord,
} from '../utils/routes'

const defaultCenter = [-15.816, -47.965]

function RouteMapComposer({ mode, points, onAddPoint, onBoundsChange, center }) {
  const map = useMap()

  useEffect(() => {
    if (!center) return
    map.flyTo(center, map.getZoom(), { duration: 0.7 })
  }, [center, map])

  useMapEvents({
    click(event) {
      if (mode !== 'draw') return

      onAddPoint({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      })
    },
    moveend() {
      const bounds = map.getBounds()
      onBoundsChange?.({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      })
    },
  })

  useEffect(() => {
    if (points.length < 2) return

    const bounds = points.map((point) => [point.latitude, point.longitude])
    map.fitBounds(bounds, { padding: [24, 24] })
  }, [map, points])

  return null
}

export default function NewRoutePage() {
  const navigate = useNavigate()
  const { user, token, liveLocation } = useAuth()
  const preferredLocation = getPreferredLocation(user?.location, liveLocation)
  const [mode, setMode] = useState('draw')
  const [points, setPoints] = useState([])
  const [media, setMedia] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [recording, setRecording] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const [mapCenter, setMapCenter] = useState(
    preferredLocation ? [preferredLocation.latitude, preferredLocation.longitude] : defaultCenter,
  )
  const [form, setForm] = useState({
    name: '',
    sport: 'bike',
    difficulty: 'medio',
    description: '',
    estimatedMinutes: '',
  })
  const watchIdRef = useRef(null)

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  const routeDistanceKm = useMemo(() => getRouteDistanceKm(points), [points])
  const computedMinutes = useMemo(
    () => estimateRouteDurationMinutes(routeDistanceKm, form.sport),
    [form.sport, routeDistanceKm],
  )
  const routeColor = getRouteSport(form.sport).color

  async function handleUseCurrentLocation() {
    setLoadingLocation(true)
    setError('')

    try {
      const location = await getCurrentPosition({ force: true })
      setMapCenter([location.latitude, location.longitude])
      setStatusMessage('Mapa centralizado na sua posicao atual.')
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setLoadingLocation(false)
    }
  }

  function handleAddPoint(point) {
    setPoints((current) => [...current, point])
    setStatusMessage('Ponto adicionado na rota.')
  }

  function handleUndoPoint() {
    setPoints((current) => current.slice(0, -1))
  }

  function handleClearPoints() {
    setPoints([])
    setStatusMessage('Percurso limpo.')
  }

  async function handleToggleRecording() {
    if (recording) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      watchIdRef.current = null
      setRecording(false)
      setStatusMessage('Gravacao encerrada.')
      return
    }

    if (!navigator.geolocation) {
      setError('Seu navegador nao suporta gravacao de trajeto via GPS.')
      return
    }

    setError('')
    setStatusMessage('Gravando sua rota em tempo real...')
    setRecording(true)

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }

        setMapCenter([nextPoint.latitude, nextPoint.longitude])
        setPoints((current) => {
          const previousPoint = current[current.length - 1]
          const movedDistance = previousPoint ? distanceBetween(previousPoint, nextPoint) : 1

          if (movedDistance !== null && movedDistance < 0.015) {
            return current
          }

          return [...current, nextPoint]
        })
      },
      () => {
        setRecording(false)
        setError('Nao foi possivel acompanhar seu trajeto em tempo real.')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    )
  }

  async function handleMediaChange(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    setUploading(true)
    setError('')

    try {
      const uploadedItems = []

      for (const file of files) {
        const kind = file.type.startsWith('video/') ? 'video' : 'image'
        const uploadedUrl = await uploadSelectedFile(file, {
          token,
          kind,
        })

        uploadedItems.push({
          id: `${uploadedUrl}-${Date.now()}`,
          title: file.name.replace(/\.[^.]+$/, ''),
          fileUrl: uploadedUrl,
          mediaType: kind === 'video' ? 'video' : 'photo',
        })
      }

      setMedia((current) => [...current, ...uploadedItems])
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const route = createRouteRecord({
        name: form.name,
        sport: form.sport,
        description: form.description,
        difficulty: form.difficulty,
        estimatedMinutes: form.estimatedMinutes,
        points,
        media,
        authorSnapshot: createRouteAuthorSnapshot(user),
      })

      const savedRoute = saveRouteRecord(route)
      navigate(`/rotas/${savedRoute.id}`)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <h1>Entre para gravar uma rota</h1>
          <p className="muted-text">
            O PicoHunter salva rotas no seu navegador nesta primeira fase.
          </p>
          <Link className="primary-button small-link-button" to="/entrar">
            Entrar agora
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page-grid social-page">
      <div className="page-column page-column-main feed-column">
        <div className="hero-card route-creator-hero">
          <div className="section-title compact-section-title">
            <div>
              <p className="eyebrow">PicoHunter</p>
              <h1>Nova rota</h1>
            </div>
            <div className="inline-actions wrap-actions">
              <button className="secondary-button" type="button" onClick={handleUseCurrentLocation}>
                {loadingLocation ? 'Centralizando...' : 'Minha posicao'}
              </button>
              <button
                className={recording ? 'primary-button' : 'secondary-button'}
                type="button"
                onClick={handleToggleRecording}
              >
                {recording ? 'Parar GPS' : 'Gravar GPS'}
              </button>
            </div>
          </div>

          <div className="chip-row">
            <button className={mode === 'draw' ? 'chip active' : 'chip'} type="button" onClick={() => setMode('draw')}>
              Desenhar no mapa
            </button>
            <button className={mode === 'gps' ? 'chip active' : 'chip'} type="button" onClick={() => setMode('gps')}>
              Acompanhar GPS
            </button>
          </div>

          <div className="map-card">
            <div className="map-card-header">
              <div>
                <strong>{mode === 'draw' ? 'Toque para desenhar o percurso' : 'GPS ao vivo'}</strong>
                <p>
                  {mode === 'draw'
                    ? 'Cada toque adiciona um novo ponto da rota.'
                    : 'Inicie a gravacao e se mova para registrar o trajeto.'}
                </p>
              </div>
              <span className="status-pill">{points.length} pontos</span>
            </div>

            <div className="leaflet-shell">
              <MapContainer center={mapCenter} zoom={14} scrollWheelZoom className="leaflet-map">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <RouteMapComposer
                  center={mapCenter}
                  mode={mode}
                  points={points}
                  onAddPoint={handleAddPoint}
                />

                {points.length ? (
                  <>
                    <Polyline
                      positions={points.map((point) => [point.latitude, point.longitude])}
                      pathOptions={{ color: routeColor, weight: 6, lineCap: 'round', lineJoin: 'round' }}
                    />
                    <CircleMarker
                      center={[points[0].latitude, points[0].longitude]}
                      radius={8}
                      pathOptions={{ color: '#ffffff', fillColor: routeColor, fillOpacity: 1 }}
                    />
                    <CircleMarker
                      center={[points[points.length - 1].latitude, points[points.length - 1].longitude]}
                      radius={8}
                      pathOptions={{ color: '#ffffff', fillColor: '#3b82f6', fillOpacity: 1 }}
                    />
                  </>
                ) : null}
              </MapContainer>
            </div>

            <div className="inline-actions wrap-actions route-creator-toolbar">
              <button className="ghost-button small-button" type="button" onClick={handleUndoPoint} disabled={!points.length}>
                Desfazer ultimo ponto
              </button>
              <button className="ghost-button small-button" type="button" onClick={handleClearPoints} disabled={!points.length}>
                Limpar rota
              </button>
            </div>
          </div>
        </div>

        <form className="side-card route-form-card" onSubmit={handleSubmit}>
          <div className="section-title compact-section-title">
            <h2>Detalhes do percurso</h2>
            <span className="status-pill">{formatRouteDistance(routeDistanceKm)}</span>
          </div>

          <label>
            Nome da rota
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ex: Midnight street line"
            />
          </label>

          <div className="two-column-grid">
            <label>
              Esporte
              <select
                value={form.sport}
                onChange={(event) => setForm((current) => ({ ...current, sport: event.target.value }))}
              >
                {getRouteSportOptions().map((sport) => (
                  <option key={sport.slug} value={sport.slug}>
                    {sport.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Dificuldade
              <select
                value={form.difficulty}
                onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value }))}
              >
                {getRouteDifficultyOptions().map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Tempo estimado em minutos
            <input
              type="number"
              min="1"
              value={form.estimatedMinutes}
              onChange={(event) => setForm((current) => ({ ...current, estimatedMinutes: event.target.value }))}
              placeholder={`${computedMinutes}`}
            />
          </label>

          <label>
            Descricao
            <textarea
              rows="4"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Conta o clima da rota, os pontos fortes e o tipo de role ideal."
            />
          </label>

          <div className="route-live-stats">
            <article>
              <span>Distancia</span>
              <strong>{formatRouteDistance(routeDistanceKm)}</strong>
            </article>
            <article>
              <span>Estimativa</span>
              <strong>{formatRouteDuration(Number(form.estimatedMinutes || computedMinutes))}</strong>
            </article>
            <article>
              <span>Visual</span>
              <strong>{getRouteSport(form.sport).name}</strong>
            </article>
          </div>

          <label>
            Fotos e videos da rota
            <input type="file" accept="image/*,video/*" multiple onChange={handleMediaChange} />
          </label>

          {media.length ? (
            <div className="route-media-strip">
              {media.map((item) => (
                <div key={item.id} className="route-upload-card">
                  <MediaAsset
                    className={item.mediaType === 'video' ? 'route-upload-thumb route-upload-thumb-video' : 'route-upload-thumb'}
                    src={item.fileUrl}
                    alt={item.title}
                    mediaType={item.mediaType}
                    controls={item.mediaType === 'video'}
                  />
                  <button
                    className="ghost-button small-button"
                    type="button"
                    onClick={() => setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id))}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {statusMessage ? <p className="success-text">{statusMessage}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}

          <button
            className="primary-button full-width"
            disabled={saving || uploading || points.length < 2 || !form.name.trim()}
          >
            {saving ? 'Salvando rota...' : uploading ? 'Enviando midia...' : 'Salvar rota'}
          </button>
        </form>
      </div>
    </section>
  )
}
