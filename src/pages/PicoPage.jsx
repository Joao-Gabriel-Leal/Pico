import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import { uploadSelectedFile } from '../utils/files'

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatCoordinates(detail) {
  return `${Number(detail.latitude).toFixed(5)}, ${Number(detail.longitude).toFixed(5)}`
}

export default function PicoPage() {
  const { slug } = useParams()
  const { token, user } = useAuth()
  const [detail, setDetail] = useState(null)
  const [sports, setSports] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [contributionAmount, setContributionAmount] = useState('20')
  const [campaignForm, setCampaignForm] = useState({
    title: '',
    purpose: '',
    goalCents: 500000,
  })
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    sportId: '',
    startsAt: '',
    entryFeeCents: 0,
    prizePoolCents: 0,
  })
  const [mediaForm, setMediaForm] = useState({
    mediaType: 'photo',
    title: '',
    fileUrl: '',
  })

  useEffect(() => {
    async function loadPage() {
      const [picoPayload, referencePayload] = await Promise.all([
        apiRequest(`/api/picos/${slug}`, { token }),
        apiRequest('/api/auth/options'),
      ])
      setDetail(picoPayload.item)
      setSports(referencePayload.sports)
      setEventForm((current) => ({
        ...current,
        sportId: current.sportId || picoPayload.item.sport.id,
      }))
    }

    loadPage().catch((nextError) => setError(nextError.message))
  }, [slug, token])

  async function refreshDetail() {
    const payload = await apiRequest(`/api/picos/${slug}`, { token })
    setDetail(payload.item)
    return payload.item
  }

  async function handleVote() {
    setMessage('')
    setError('')

    try {
      await apiRequest(`/api/picos/${slug}/vote`, {
        method: 'POST',
        token,
      })
      await refreshDetail()
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleContribution(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      await apiRequest(`/api/picos/${slug}/contributions`, {
        method: 'POST',
        token,
        body: {
          amountCents: Number(contributionAmount) * 100,
        },
      })
      await refreshDetail()
      setMessage('Contribuicao registrada.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleCampaignSubmit(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      await apiRequest(`/api/picos/${slug}/campaigns`, {
        method: 'POST',
        token,
        body: campaignForm,
      })
      await refreshDetail()
      setCampaignForm({
        title: '',
        purpose: '',
        goalCents: 500000,
      })
      setMessage('Vaquinha aberta com sucesso.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleEventSubmit(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      await apiRequest(`/api/picos/${slug}/events`, {
        method: 'POST',
        token,
        body: eventForm,
      })
      await refreshDetail()
      setEventForm((current) => ({
        ...current,
        title: '',
        description: '',
        startsAt: '',
        entryFeeCents: 0,
        prizePoolCents: 0,
      }))
      setMessage('Evento criado no perfil do pico.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleMediaFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingMedia(true)
    setError('')

    try {
      const uploadedUrl = await uploadSelectedFile(file, {
        token,
        kind: mediaForm.mediaType === 'video' ? 'video' : 'image',
      })

      setMediaForm((current) => ({
        ...current,
        fileUrl: uploadedUrl,
        title: current.title || file.name.replace(/\.[^.]+$/, ''),
      }))
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setUploadingMedia(false)
      event.target.value = ''
    }
  }

  async function handleMediaSubmit(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      await apiRequest(`/api/picos/${slug}/media`, {
        method: 'POST',
        token,
        body: mediaForm,
      })
      await refreshDetail()
      setMediaForm({
        mediaType: 'photo',
        title: '',
        fileUrl: '',
      })
      setMessage('Post publicado no pico.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  if (error && !detail) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <h1>Pico nao encontrado</h1>
          <p className="error-text">{error}</p>
          <Link className="primary-button small-link-button" to="/mapa">
            Voltar
          </Link>
        </div>
      </section>
    )
  }

  if (!detail) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <p className="muted-text">Carregando perfil do pico...</p>
        </div>
      </section>
    )
  }

  const activeCampaign = detail.campaigns.find((item) => item.status === 'active')
  const photoItems = detail.media.filter((item) => item.mediaType === 'photo')

  return (
    <section className="page-grid social-page">
      <div className="page-column page-column-main feed-column">
        <div className="hero-card pico-hero">
          <div className="pico-hero-grid">
            <div>
              <p className="eyebrow">Perfil do pico</p>
              <h1>{detail.name}</h1>
              <p className="hero-copy">{detail.sport.name} - {detail.description}</p>

              <div className="hero-actions">
                <span className="status-pill">{detail.conditionLabel}</span>
                <span className="status-pill">{detail.voteCount} votos</span>
                {user ? (
                  <button className="secondary-button" type="button" onClick={handleVote}>
                    {detail.hasVoted ? 'Tirar voto' : 'Votar neste pico'}
                  </button>
                ) : (
                  <Link className="secondary-button small-link-button" to="/entrar">
                    Entrar para votar
                  </Link>
                )}
              </div>
            </div>

            <MediaAsset className="hero-image" src={detail.coverImageUrl || detail.previewPhoto} alt={detail.name} />
          </div>
        </div>

        <div className="two-card-grid">
          <div className="side-card">
            <div className="section-title">
              <h2>Resumo</h2>
              <span>{detail.statusText}</span>
            </div>
            <div className="stats-stack">
              <article>
                <span>Coordenadas</span>
                <strong>{formatCoordinates(detail)}</strong>
              </article>
              <article>
                <span>Posts</span>
                <strong>{detail.media.length}</strong>
              </article>
              <article>
                <span>Votos</span>
                <strong>{detail.voteCount}</strong>
              </article>
            </div>
          </div>

          <div className="side-card">
            <div className="section-title">
              <h2>Top 5 videos</h2>
              <span>semana</span>
            </div>
            <div className="list-stack compact-list">
              {detail.topVideos.length ? (
                detail.topVideos.map((item, index) => (
                  <div key={item.id} className="list-item static-item">
                    <div>
                      <strong>
                        {index + 1}. {item.title}
                      </strong>
                      <p>{item.viewsCount} views</p>
                    </div>
                    <span>{item.likesCount} likes</span>
                  </div>
                ))
              ) : (
                <p className="muted-text">Ainda nao ha videos ranqueados.</p>
              )}
            </div>
          </div>
        </div>

        <div className="section-title">
          <h2>Feed do pico</h2>
          <span>{detail.media.length}</span>
        </div>

        <div className="list-stack">
          {detail.media.length ? (
            detail.media.map((item) => (
              <article key={item.id} className="post-card">
                <div className="post-card-header">
                  <div className="user-chip">
                    <div className="avatar-circle avatar-mini">
                      {(detail.creator?.displayName || detail.name).slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.mediaType === 'video' ? 'Video do pico' : 'Foto do pico'}</p>
                    </div>
                  </div>
                  <span className="pill">{item.likesCount} likes</span>
                </div>

                <MediaAsset
                  className={item.mediaType === 'video' ? 'feed-video' : 'cover-thumb'}
                  src={item.fileUrl}
                  alt={item.title}
                  mediaType={item.mediaType}
                />
              </article>
            ))
          ) : (
            <div className="side-card empty-state">
              <p className="muted-text">Esse pico ainda nao tem posts publicados.</p>
            </div>
          )}
        </div>

        <div className="photo-grid">
          {photoItems.map((item) => (
            <MediaAsset
              key={item.id}
              className="gallery-image"
              src={item.fileUrl}
              alt={item.title}
              mediaType="photo"
            />
          ))}
        </div>
      </div>

      <aside className="page-column rail-column">
        <div className="side-card sticky-card">
          <div className="section-title">
            <h2>Publicar no pico</h2>
            <span>feed</span>
          </div>

          {user ? (
            <form className="form-card compact-form" onSubmit={handleMediaSubmit}>
              <label>
                Tipo
                <select
                  value={mediaForm.mediaType}
                  onChange={(event) =>
                    setMediaForm((current) => ({
                      ...current,
                      mediaType: event.target.value,
                      fileUrl: '',
                    }))
                  }
                >
                  <option value="photo">Foto</option>
                  <option value="video">Video</option>
                </select>
              </label>

              <label>
                Titulo
                <input
                  value={mediaForm.title}
                  onChange={(event) =>
                    setMediaForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </label>

              <label>
                Arquivo
                <input
                  type="file"
                  accept={mediaForm.mediaType === 'video' ? 'video/*' : 'image/*'}
                  onChange={handleMediaFileChange}
                />
              </label>

              {mediaForm.fileUrl ? (
                <MediaAsset
                  className={mediaForm.mediaType === 'video' ? 'feed-video' : 'image-preview'}
                  src={mediaForm.fileUrl}
                  alt="Preview do post"
                  mediaType={mediaForm.mediaType}
                />
              ) : null}

              <button className="primary-button full-width" disabled={uploadingMedia || !mediaForm.fileUrl}>
                {uploadingMedia ? 'Enviando...' : 'Publicar no pico'}
              </button>
            </form>
          ) : (
            <Link className="primary-button small-link-button full-width" to="/entrar">
              Entrar para postar
            </Link>
          )}

          <div className="section-divider" />

          <div className="section-title">
            <h2>Vaquinha</h2>
            <span>{activeCampaign ? 'ativa' : 'nenhuma aberta'}</span>
          </div>

          {activeCampaign ? (
            <>
              <div className="mini-card">
                <strong>{activeCampaign.title}</strong>
                <p>{activeCampaign.purpose}</p>
                <span>
                  {activeCampaign.raisedLabel} de {activeCampaign.goalLabel}
                </span>
              </div>

              {user ? (
                <form className="form-card compact-form" onSubmit={handleContribution}>
                  <label>
                    Valor em reais
                    <input
                      value={contributionAmount}
                      onChange={(event) => setContributionAmount(event.target.value)}
                    />
                  </label>
                  <button className="primary-button full-width">Contribuir</button>
                </form>
              ) : (
                <Link className="primary-button small-link-button full-width" to="/entrar">
                  Entrar para contribuir
                </Link>
              )}
            </>
          ) : user ? (
            <form className="form-card compact-form" onSubmit={handleCampaignSubmit}>
              <label>
                Titulo da vaquinha
                <input
                  value={campaignForm.title}
                  onChange={(event) =>
                    setCampaignForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </label>
              <label>
                Objetivo
                <textarea
                  rows="3"
                  value={campaignForm.purpose}
                  onChange={(event) =>
                    setCampaignForm((current) => ({ ...current, purpose: event.target.value }))
                  }
                />
              </label>
              <label>
                Meta em centavos
                <input
                  value={campaignForm.goalCents}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,
                      goalCents: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <button className="primary-button full-width">Abrir vaquinha</button>
            </form>
          ) : (
            <Link className="primary-button small-link-button full-width" to="/entrar">
              Entrar para abrir vaquinha
            </Link>
          )}

          <div className="section-divider" />

          <div className="section-title">
            <h2>Eventos do pico</h2>
            <span>{detail.events.length}</span>
          </div>

          <div className="list-stack compact-list">
            {detail.events.map((event) => (
              <div key={event.id} className="list-item static-item">
                <div>
                  <strong>{event.title}</strong>
                  <p>{formatDate(event.startsAt)}</p>
                </div>
                <span>{event.prizePoolLabel}</span>
              </div>
            ))}
          </div>

          {user ? (
            <form className="form-card compact-form" onSubmit={handleEventSubmit}>
              <label>
                Titulo do evento
                <input
                  value={eventForm.title}
                  onChange={(event) =>
                    setEventForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </label>

              <label>
                Esporte
                <select
                  value={eventForm.sportId}
                  onChange={(event) =>
                    setEventForm((current) => ({ ...current, sportId: Number(event.target.value) }))
                  }
                >
                  <option value="">Selecione</option>
                  {sports.map((sport) => (
                    <option key={sport.id} value={sport.id}>
                      {sport.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Data e hora
                <input
                  type="datetime-local"
                  value={eventForm.startsAt}
                  onChange={(event) =>
                    setEventForm((current) => ({ ...current, startsAt: event.target.value }))
                  }
                />
              </label>

              <div className="two-column-grid">
                <label>
                  Inscricao
                  <input
                    value={eventForm.entryFeeCents}
                    onChange={(event) =>
                      setEventForm((current) => ({
                        ...current,
                        entryFeeCents: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Premio
                  <input
                    value={eventForm.prizePoolCents}
                    onChange={(event) =>
                      setEventForm((current) => ({
                        ...current,
                        prizePoolCents: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              <label>
                Descricao
                <textarea
                  rows="3"
                  value={eventForm.description}
                  onChange={(event) =>
                    setEventForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>

              <button className="primary-button full-width">Criar evento</button>
            </form>
          ) : null}

          {message ? <p className="success-text">{message}</p> : null}
          {error && detail ? <p className="error-text">{error}</p> : null}
        </div>
      </aside>
    </section>
  )
}
