import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import { getDisplayName, getInitial } from '../utils/text'
import {
  addRouteComment,
  buildSharedRouteUrl,
  formatRouteDistance,
  formatRouteDuration,
  getStoredRouteById,
  importSharedRoute,
  toggleRouteLike,
  toggleRouteSave,
} from '../utils/routes'

export default function RouteDetailPage() {
  const { routeId } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [item, setItem] = useState(null)
  const [tracking, setTracking] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const watchIdRef = useRef(null)

  useEffect(() => {
    const sharedPayload = searchParams.get('share')
    let route = getStoredRouteById(routeId)

    if (!route && sharedPayload) {
      route = importSharedRoute(sharedPayload)
    }

    if (!route) {
      setError('Rota nao encontrada nesse navegador.')
      return
    }

    setItem(route)
  }, [routeId, searchParams])

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  const shareUrl = useMemo(() => {
    if (!item) return ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return buildSharedRouteUrl(item, origin)
  }, [item])

  async function handleToggleTracking() {
    if (tracking) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }

      watchIdRef.current = null
      setTracking(false)
      setMessage('Acompanhamento da rota encerrado.')
      return
    }

    if (!navigator.geolocation) {
      setError('Seu navegador nao suporta acompanhar o trajeto em tempo real.')
      return
    }

    setTracking(true)
    setError('')
    setMessage('Acompanhando voce ao vivo na rota.')

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => {
        setTracking(false)
        setError('Nao foi possivel iniciar o acompanhamento dessa rota.')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    )
  }

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: item.name,
          text: 'Rota compartilhada pelo PicoHunter',
          url: shareUrl,
        })
      } else {
        await navigator.clipboard.writeText(shareUrl)
      }

      setMessage('Rota pronta para compartilhar.')
    } catch {
      setError('Nao foi possivel compartilhar essa rota agora.')
    }
  }

  function handleLike() {
    try {
      const nextItem = toggleRouteLike(item.id)
      setItem(nextItem)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  function handleSave() {
    try {
      const nextItem = toggleRouteSave(item.id)
      setItem(nextItem)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  function handleCommentSubmit(event) {
    event.preventDefault()
    if (!user || !commentText.trim()) return

    try {
      const nextItem = addRouteComment(item.id, commentText, user)
      setItem(nextItem)
      setCommentText('')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  if (!item) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <h1>Rota indisponivel</h1>
          <p className="muted-text">{error || 'Carregando rota...'}</p>
          <Link className="primary-button small-link-button" to="/mapa">
            Voltar ao mapa
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page-grid social-page">
      <div className="page-column page-column-main feed-column">
        <div className="hero-card route-detail-hero">
          <div className="section-title compact-section-title">
            <div>
              <p className="eyebrow">PicoHunter Route</p>
              <h1>{item.name}</h1>
            </div>
            <div className="inline-actions wrap-actions">
              <button className={tracking ? 'primary-button' : 'secondary-button'} type="button" onClick={handleToggleTracking}>
                {tracking ? 'Parar rota' : 'Iniciar rota'}
              </button>
              <button className={item.savedByCurrentUser ? 'primary-button' : 'secondary-button'} type="button" onClick={handleSave}>
                {item.savedByCurrentUser ? 'Salva' : 'Salvar'}
              </button>
              <button className="secondary-button" type="button" onClick={handleShare}>
                Compartilhar
              </button>
            </div>
          </div>

          <div className="map-card">
            <div className="leaflet-shell">
              <MapContainer
                center={[item.points[0].latitude, item.points[0].longitude]}
                zoom={14}
                scrollWheelZoom
                className="leaflet-map"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Polyline
                  positions={item.points.map((point) => [point.latitude, point.longitude])}
                  pathOptions={{ color: item.sportMeta?.color, weight: 6, lineCap: 'round', lineJoin: 'round' }}
                />
                <CircleMarker
                  center={[item.points[0].latitude, item.points[0].longitude]}
                  radius={8}
                  pathOptions={{ color: '#ffffff', fillColor: item.sportMeta?.color, fillOpacity: 1 }}
                />
                <CircleMarker
                  center={[item.points[item.points.length - 1].latitude, item.points[item.points.length - 1].longitude]}
                  radius={8}
                  pathOptions={{ color: '#ffffff', fillColor: '#3b82f6', fillOpacity: 1 }}
                />
                {currentPosition ? (
                  <CircleMarker
                    center={[currentPosition.latitude, currentPosition.longitude]}
                    radius={10}
                    pathOptions={{ color: '#ffffff', fillColor: '#f8fafc', fillOpacity: 1 }}
                  />
                ) : null}
              </MapContainer>
            </div>
          </div>
        </div>

        <div className="two-card-grid">
          <div className="side-card">
            <div className="section-title compact-section-title">
              <h2>Resumo da rota</h2>
              <span className="pill">{item.difficultyMeta?.name}</span>
            </div>

            <div className="route-live-stats">
              <article>
                <span>Distancia</span>
                <strong>{formatRouteDistance(item.distanceKm)}</strong>
              </article>
              <article>
                <span>Duracao</span>
                <strong>{formatRouteDuration(item.estimatedMinutes)}</strong>
              </article>
              <article>
                <span>Esporte</span>
                <strong>{item.sportMeta?.name}</strong>
              </article>
            </div>

            <p className="hero-copy">
              {item.description || 'Rota criada para explorar a cidade com movimento continuo e flow de rua.'}
            </p>

            <div className="route-feed-actions route-detail-actions">
              <button className={item.likedByCurrentUser ? 'icon-button active' : 'icon-button'} type="button" onClick={handleLike}>
                <span>{item.likesCount} likes</span>
              </button>
              <button className={item.savedByCurrentUser ? 'icon-button active' : 'icon-button'} type="button" onClick={handleSave}>
                <span>{item.savedByCurrentUser ? 'Rota salva' : 'Salvar depois'}</span>
              </button>
            </div>
          </div>

          <div className="side-card">
            <div className="section-title compact-section-title">
              <h2>Criador</h2>
            </div>

            <div className="user-chip">
              {item.authorSnapshot?.avatarUrl ? (
                <MediaAsset className="avatar-circle avatar-mini" src={item.authorSnapshot.avatarUrl} alt={getDisplayName(item.authorSnapshot.displayName, 'Hunter')} />
              ) : (
                <div className="avatar-circle avatar-mini">{getInitial(item.authorSnapshot?.displayName, 'H')}</div>
              )}
              <div>
                <strong>{getDisplayName(item.authorSnapshot?.displayName, 'Hunter')}</strong>
                <p>@{item.authorSnapshot?.username || 'picohunter'}</p>
              </div>
            </div>
          </div>
        </div>

        {item.media.length ? (
          <div className="side-card">
            <div className="section-title compact-section-title">
              <h2>Midia da rota</h2>
              <span>{item.media.length}</span>
            </div>
            <div className="route-media-strip">
              {item.media.map((mediaItem) => (
                <MediaAsset
                  key={mediaItem.id}
                  className={mediaItem.mediaType === 'video' ? 'route-upload-thumb route-upload-thumb-video' : 'route-upload-thumb'}
                  src={mediaItem.fileUrl}
                  alt={mediaItem.title}
                  mediaType={mediaItem.mediaType}
                  controls={mediaItem.mediaType === 'video'}
                  expandable
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="side-card">
          <div className="section-title compact-section-title">
            <h2>Comentarios</h2>
            <span>{item.commentsCount}</span>
          </div>

          <div className="comments-sheet-list">
            {item.comments.length ? (
              item.comments.map((comment) => (
                <article key={comment.id} className="comment-card">
                  <strong>{getDisplayName(comment.author?.displayName, 'Hunter')}</strong>
                  <p>{comment.text}</p>
                </article>
              ))
            ) : (
              <p className="muted-text">Ninguem comentou nessa rota ainda.</p>
            )}
          </div>

          {user ? (
            <form className="comment-sheet-form" onSubmit={handleCommentSubmit}>
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Deixa uma dica sobre a rota..."
              />
              <button className="primary-button" type="submit" disabled={!commentText.trim()}>
                Enviar
              </button>
            </form>
          ) : null}
        </div>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </section>
  )
}
