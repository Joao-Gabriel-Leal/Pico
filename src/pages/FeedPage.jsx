import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import SocialPostCard from '../components/SocialPostCard'
import { uploadSelectedFile } from '../utils/files'

const pageSize = 6

export default function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, token } = useAuth()
  const [items, setItems] = useState([])
  const [picos, setPicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextOffset, setNextOffset] = useState(0)
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    picoSlug: '',
    mediaType: 'video',
    title: '',
    fileUrl: '',
  })
  const [showComposer, setShowComposer] = useState(searchParams.get('compose') === '1')
  const sentinelRef = useRef(null)

  useEffect(() => {
    setShowComposer(searchParams.get('compose') === '1')
  }, [searchParams])

  async function loadFeed({ reset = false } = {}) {
    const targetOffset = reset ? 0 : nextOffset

    if (reset) {
      setLoading(true)
      setError('')
    } else {
      if (loadingMore || !hasMore) return
      setLoadingMore(true)
    }

    try {
      const payload = await apiRequest(`/api/feed?limit=${pageSize}&offset=${targetOffset}`, {
        token,
      })

      setItems((current) => (reset ? payload.items : [...current, ...payload.items]))
      setHasMore(payload.hasMore)
      setNextOffset(payload.nextOffset)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  async function loadPage() {
    setLoading(true)

    try {
      const [feedPayload, picosPayload] = await Promise.all([
        apiRequest(`/api/feed?limit=${pageSize}&offset=0`, { token }),
        apiRequest('/api/picos', { token }),
      ])

      setItems(feedPayload.items)
      setHasMore(feedPayload.hasMore)
      setNextOffset(feedPayload.nextOffset)
      setPicos(picosPayload.items)
      setForm((current) => ({
        ...current,
        picoSlug: current.picoSlug || picosPayload.items[0]?.slug || '',
      }))
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPage()
  }, [token])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadFeed()
        }
      },
      {
        rootMargin: '160px 0px',
      },
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, nextOffset, loadingMore, token])

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
      setMessage('Post publicado no feed.')
      setForm((current) => ({
        ...current,
        title: '',
        fileUrl: '',
      }))
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.delete('compose')
        return next
      })
      setShowComposer(false)
      await loadPage()
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

  return (
    <section className="page-grid social-page">
      <div className="page-column page-column-main feed-column">
        <div className="toolbar-card compact-page-header">
          <div className="section-title compact-section-title">
            <div>
              <p className="eyebrow">Comunidade</p>
              <h1>Feed</h1>
            </div>
            <button
              className="primary-button small-link-button"
              onClick={() => {
                const nextVisible = !showComposer
                setShowComposer(nextVisible)
                setSearchParams((current) => {
                  const next = new URLSearchParams(current)
                  if (!nextVisible) next.delete('compose')
                  else next.set('compose', '1')
                  return next
                })
              }}
            >
              {showComposer ? 'Fechar criacao' : 'Nova publicacao'}
            </button>
          </div>
          <div className="chip-row compact-chip-row">
            <span className="status-pill">{items.length} posts</span>
          </div>
        </div>

        {showComposer ? (
          <div className="side-card compose-card">
            <div className="section-title compact-section-title">
              <h2>Novo post</h2>
            </div>

            {user ? (
              <form className="form-card compact-form" onSubmit={handlePublish}>
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

                <label>
                  Tipo
                  <select
                    value={form.mediaType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        mediaType: event.target.value,
                        fileUrl: '',
                      }))
                    }
                  >
                    <option value="video">Video</option>
                    <option value="photo">Foto</option>
                  </select>
                </label>

                <label>
                  Titulo
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
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

                <button
                  className="primary-button full-width"
                  disabled={saving || uploadingFile || !form.picoSlug || !form.fileUrl}
                >
                  {saving ? 'Publicando...' : 'Publicar no feed'}
                </button>
              </form>
            ) : (
              <div className="empty-state">
                <p className="muted-text">Entre para publicar fotos e videos no feed dos picos.</p>
                <Link className="primary-button small-link-button full-width" to="/entrar">
                  Entrar agora
                </Link>
              </div>
            )}
          </div>
        ) : null}

        {loading ? <div className="side-card">Carregando feed...</div> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <div className="list-stack">
          {items.length ? (
            items.map((item) => (
              <SocialPostCard
                key={item.id}
                item={item}
                token={token}
                currentUser={user}
                onUpdated={handlePostUpdated}
                onDeleted={handlePostDeleted}
              />
            ))
          ) : (
            <div className="side-card empty-state">
              <p className="muted-text">Ainda nao existem posts publicados nos picos.</p>
            </div>
          )}
        </div>

        <div ref={sentinelRef} className="feed-sentinel">
          {loadingMore ? <span className="status-pill">Carregando mais posts...</span> : null}
          {!hasMore && items.length ? <span className="status-pill">Voce chegou no fim do feed.</span> : null}
        </div>
      </div>
    </section>
  )
}
