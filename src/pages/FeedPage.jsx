import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import ReelPost from '../components/ReelPost'
import { uploadSelectedFile } from '../utils/files'

const pageSize = 5

export default function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, token } = useAuth()
  const [items, setItems] = useState([])
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
      { rootMargin: '400px 0px' },
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, nextCursor, loadingMore, token])

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

      setMessage('Publicado no feed.')
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

  return (
    <section className="reels-page">
      <div className="reels-page-header">
        <div>
          <p className="eyebrow">PicoMap</p>
          <h1>Feed</h1>
        </div>
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
          {showComposer ? 'Fechar' : 'Postar'}
        </button>
      </div>

      {showComposer ? (
        <div className="sheet-backdrop" onClick={() => setShowComposer(false)}>
          <div className="composer-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <strong>Nova publicacao</strong>
              <button className="icon-button" type="button" onClick={() => setShowComposer(false)}>
                x
              </button>
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
                    placeholder="Fale do role, da sessao ou da manobra"
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
                  {saving ? 'Publicando...' : uploadingFile ? 'Enviando arquivo...' : 'Publicar'}
                </button>
              </form>
            ) : (
              <div className="empty-state">
                <p className="muted-text">Entre para publicar no feed do PicoMap.</p>
                <Link className="primary-button small-link-button full-width" to="/entrar">
                  Entrar agora
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {loading ? <div className="dark-empty-state">Carregando feed...</div> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="reels-feed">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="reel-slot">
              <ReelPost
                item={item}
                token={token}
                currentUser={user}
                onUpdated={handlePostUpdated}
                onDeleted={handlePostDeleted}
              />
            </div>
          ))
        ) : !loading ? (
          <div className="dark-empty-state">Ainda nao existem publicacoes no feed.</div>
        ) : null}
      </div>

      <div ref={sentinelRef} className="feed-sentinel">
        {loadingMore ? <span className="status-pill">Carregando mais...</span> : null}
      </div>
    </section>
  )
}
