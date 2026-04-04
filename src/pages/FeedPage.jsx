import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import RouteFeedCard from '../components/RouteFeedCard'
import SocialPostCard from '../components/SocialPostCard'
import { uploadSelectedFile } from '../utils/files'
import { distanceBetween, getPreferredLocation } from '../utils/geo'
import {
  getRouteDistanceFromLocation,
  listStoredRoutes,
  routeUpdateEvent,
} from '../utils/routes'

const pageSize = 6

function formatDistance(distanceKm) {
  if (distanceKm === null) return ''
  return `${distanceKm.toFixed(1)} km`
}

export default function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, token, liveLocation } = useAuth()
  const [items, setItems] = useState([])
  const [routes, setRoutes] = useState(() => listStoredRoutes())
  const [picos, setPicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextCursor, setNextCursor] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showComposer, setShowComposer] = useState(searchParams.get('compose') === '1')
  const [form, setForm] = useState({
    picoSlug: '',
    mediaType: 'video',
    title: '',
    fileUrl: '',
  })
  const sentinelRef = useRef(null)

  useEffect(() => {
    setShowComposer(searchParams.get('compose') === '1')
  }, [searchParams])

  useEffect(() => {
    function handleRoutesUpdated() {
      setRoutes(listStoredRoutes())
    }

    window.addEventListener(routeUpdateEvent, handleRoutesUpdated)
    return () => window.removeEventListener(routeUpdateEvent, handleRoutesUpdated)
  }, [])

  async function loadInitial() {
    setLoading(true)
    setError('')

    try {
      const [feedPayload, picosPayload] = await Promise.all([
        apiRequest(`/api/feed?limit=${pageSize}`, { token }),
        apiRequest('/api/picos', { token }),
      ])

      const visiblePicos = (picosPayload.items || []).filter((item) => item.approvalStatus === 'approved')
      setItems(feedPayload.items || [])
      setHasMore(Boolean(feedPayload.hasMore))
      setNextCursor(feedPayload.nextCursor || '')
      setPicos(visiblePicos)
      setRoutes(listStoredRoutes())
      setForm((current) => ({
        ...current,
        picoSlug: current.picoSlug || visiblePicos[0]?.slug || '',
      }))
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore || !nextCursor) return

    setLoadingMore(true)

    try {
      const payload = await apiRequest(
        `/api/feed?limit=${pageSize}&cursor=${encodeURIComponent(nextCursor)}`,
        { token },
      )
      setItems((current) => [...current, ...(payload.items || [])])
      setHasMore(Boolean(payload.hasMore))
      setNextCursor(payload.nextCursor || '')
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    loadInitial()
  }, [token])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || !nextCursor) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '320px 0px' },
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, nextCursor, loadingMore])

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    setError('')

    try {
      const uploadedUrl = await uploadSelectedFile(file, {
        token,
        kind: form.mediaType === 'video' ? 'video' : 'image',
      })
      setForm((current) => ({
        ...current,
        fileUrl: uploadedUrl,
        title: current.title || file.name.replace(/\.[^.]+$/, ''),
      }))
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setUploadingFile(false)
      event.target.value = ''
    }
  }

  async function handlePublish(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      await apiRequest(`/api/picos/${form.picoSlug}/media`, {
        method: 'POST',
        token,
        body: {
          scope: 'feed',
          mediaType: form.mediaType,
          title: form.title,
          fileUrl: form.fileUrl,
        },
      })

      setMessage('Publicacao dropada no feed.')
      setForm((current) => ({
        ...current,
        title: '',
        fileUrl: '',
      }))
      setShowComposer(false)
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.delete('compose')
        return next
      })
      await loadInitial()
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSaving(false)
    }
  }

  function handlePostUpdated(updatedItem) {
    setItems((current) =>
      current.map((item) => (item.id === updatedItem.id ? { ...item, ...updatedItem } : item)),
    )
  }

  function handlePostDeleted(mediaId) {
    setItems((current) => current.filter((item) => item.id !== mediaId))
  }

  function handleRouteUpdated(updatedRoute) {
    setRoutes((current) =>
      current.map((route) => (route.id === updatedRoute.id ? updatedRoute : route)),
    )
  }

  const userLocation = getPreferredLocation(user?.location, liveLocation)

  const routeFeedItems = useMemo(
    () =>
      routes.map((route) => ({
        ...route,
        kind: 'route',
        distanceLabel: formatDistance(getRouteDistanceFromLocation(route, userLocation)),
      })),
    [routes, userLocation],
  )

  const combinedFeed = useMemo(() => {
    const serverItems = items.map((item) => {
      const distanceLabel =
        userLocation && item.pico?.latitude !== undefined && item.pico?.longitude !== undefined
          ? formatDistance(
              distanceBetween(userLocation, {
                latitude: Number(item.pico.latitude),
                longitude: Number(item.pico.longitude),
              }),
            )
          : ''

      return {
        ...item,
        kind: 'post',
        distanceLabel,
      }
    })

    return [...serverItems, ...routeFeedItems].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
  }, [items, routeFeedItems, userLocation])

  return (
    <section className="feed-page-shell">
      <div className="hero-card feed-hero-card">
        <div className="section-title compact-section-title">
          <div>
            <p className="eyebrow">PicoHunter</p>
            <h1>Feed</h1>
          </div>
          <div className="inline-actions wrap-actions">
            <Link className="secondary-button small-link-button" to="/nova-rota">
              Criar rota
            </Link>
            <button
              className="primary-button small-link-button"
              type="button"
              onClick={() => {
                const nextVisible = !showComposer
                setShowComposer(nextVisible)
                setSearchParams((current) => {
                  const next = new URLSearchParams(current)
                  if (nextVisible) next.set('compose', '1')
                  else next.delete('compose')
                  return next
                })
              }}
            >
              {showComposer ? 'Fechar post' : 'Nova publicacao'}
            </button>
          </div>
        </div>

        <p className="hero-copy">
          Descobre picos, acompanha drops da comunidade e mistura rotas street com posts do mapa.
        </p>
      </div>

      {showComposer ? (
        <div className="side-card compose-inline-card">
          <div className="section-title compact-section-title">
            <h2>Nova publicacao</h2>
            <span className="status-pill">Feed oficial</span>
          </div>

          {user ? (
            <form className="compose-form-sheet" onSubmit={handlePublish}>
              <label>
                Pico
                <select
                  value={form.picoSlug}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, picoSlug: event.target.value }))
                  }
                >
                  <option value="">Selecione</option>
                  {picos.map((pico) => (
                    <option key={pico.id} value={pico.slug}>
                      {pico.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="compose-type-row">
                <button
                  className={form.mediaType === 'video' ? 'chip active' : 'chip'}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, mediaType: 'video', fileUrl: '' }))}
                >
                  Video
                </button>
                <button
                  className={form.mediaType === 'photo' ? 'chip active' : 'chip'}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, mediaType: 'photo', fileUrl: '' }))}
                >
                  Foto
                </button>
              </div>

              <label>
                Legenda
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Dropa o clima da sessao, da linha ou da manobra"
                />
              </label>

              <label>
                Arquivo
                <input
                  type="file"
                  accept={form.mediaType === 'video' ? 'video/*' : 'image/*'}
                  onChange={handleFileChange}
                />
              </label>

              {message ? <p className="success-text">{message}</p> : null}
              {error ? <p className="error-text">{error}</p> : null}

              <button
                className="primary-button full-width"
                type="submit"
                disabled={saving || uploadingFile || !form.picoSlug || !form.fileUrl}
              >
                {saving ? 'Publicando...' : uploadingFile ? 'Subindo arquivo...' : 'Publicar no feed'}
              </button>
            </form>
          ) : (
            <div className="empty-state">
              <p className="muted-text">Entre para postar no feed do PicoHunter.</p>
              <Link className="primary-button small-link-button full-width" to="/entrar">
                Entrar agora
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {loading ? <div className="dark-empty-state">Carregando o feed da cidade...</div> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="stacked-feed-grid">
        {combinedFeed.length ? (
          combinedFeed.map((item) =>
            item.kind === 'route' ? (
              <RouteFeedCard
                key={item.id}
                item={item}
                currentUser={user}
                distanceLabel={item.distanceLabel}
                onUpdated={handleRouteUpdated}
              />
            ) : (
              <SocialPostCard
                key={item.id}
                item={item}
                token={token}
                currentUser={user}
                onUpdated={handlePostUpdated}
                onDeleted={handlePostDeleted}
                autoPlayVideo={false}
              />
            ),
          )
        ) : !loading ? (
          <div className="dark-empty-state">Ainda nao tem publicacoes nem rotas salvas.</div>
        ) : null}
      </div>

      <div ref={sentinelRef} className="feed-sentinel">
        {loadingMore ? <span className="status-pill">Carregando mais...</span> : null}
      </div>
    </section>
  )
}
