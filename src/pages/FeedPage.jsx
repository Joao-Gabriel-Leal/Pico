import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import { uploadSelectedFile } from '../utils/files'

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function FeedPage() {
  const { user, token } = useAuth()
  const [items, setItems] = useState([])
  const [picos, setPicos] = useState([])
  const [loading, setLoading] = useState(true)
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

  async function loadPage() {
    setLoading(true)

    try {
      const [feedPayload, picosPayload] = await Promise.all([
        apiRequest('/api/feed', { token }),
        apiRequest('/api/picos', { token }),
      ])

      setItems(feedPayload.items)
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
      await loadPage()
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page-grid social-page">
      <div className="page-column page-column-main feed-column">
        <div className="hero-card social-hero-card">
          <div>
            <p className="eyebrow">Feed</p>
            <h1>Posts dos picos em um feed continuo, mais rede social e menos gambiarra.</h1>
            <p className="hero-copy">
              Fotos e videos publicados nos picos entram aqui como posts de verdade.
            </p>
          </div>
          <div className="highlight-chip">
            <strong>{items.length}</strong> posts no feed
          </div>
        </div>

        {loading ? <div className="side-card">Carregando feed...</div> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <div className="list-stack">
          {items.length ? (
            items.map((item) => (
              <article key={item.id} className="post-card">
                <div className="post-card-header">
                  <div className="user-chip">
                    {item.author?.avatarUrl ? (
                      <MediaAsset className="avatar-circle avatar-mini" src={item.author.avatarUrl} alt={item.author.displayName} />
                    ) : (
                      <div className="avatar-circle avatar-mini">
                        {(item.author?.displayName || 'P').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <strong>{item.author?.displayName || 'Comunidade'}</strong>
                      <p>{item.pico?.name}</p>
                    </div>
                  </div>
                  <span className="pill">{item.mediaType === 'video' ? 'Video' : 'Foto'}</span>
                </div>

                <MediaAsset
                  className={item.mediaType === 'video' ? 'feed-video' : 'cover-thumb'}
                  src={item.fileUrl}
                  alt={item.title}
                  mediaType={item.mediaType}
                />

                <div className="post-card-body">
                  <strong>{item.title}</strong>
                  <div className="meta-row">
                    <span>{item.likesCount} likes</span>
                    <span>{item.viewsCount} views</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </div>

                <div className="post-card-footer">
                  <div className="user-chip">
                    <div>
                      <strong>{item.author?.username ? `@${item.author.username}` : 'Comunidade'}</strong>
                      <p>{item.pico?.sport?.name}</p>
                    </div>
                  </div>
                  {item.pico ? (
                    <Link className="secondary-button small-link-button" to={`/picos/${item.pico.slug}`}>
                      Abrir pico
                    </Link>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <div className="side-card empty-state">
              <p className="muted-text">Ainda nao existem posts publicados nos picos.</p>
            </div>
          )}
        </div>
      </div>

      <aside className="page-column rail-column">
        <div className="side-card sticky-card">
          <div className="section-title">
            <h2>Novo post</h2>
            <span>feed</span>
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

              {form.fileUrl ? (
                <MediaAsset
                  className={form.mediaType === 'video' ? 'feed-video' : 'image-preview'}
                  src={form.fileUrl}
                  alt="Preview do post"
                  mediaType={form.mediaType}
                />
              ) : null}

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
      </aside>
    </section>
  )
}
