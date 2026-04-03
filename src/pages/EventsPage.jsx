import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import { getDisplayName, getInitial } from '../utils/text'

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function sumPrizePool(items) {
  return items.reduce((total, item) => total + Number(item.prizePoolCents || 0), 0)
}

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, token } = useAuth()
  const [items, setItems] = useState([])
  const [picos, setPicos] = useState([])
  const [sports, setSports] = useState([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    picoSlug: '',
    title: '',
    description: '',
    sportId: '',
    startsAt: '',
    entryFeeCents: 0,
    prizePoolCents: 0,
  })
  const [showComposer, setShowComposer] = useState(searchParams.get('compose') === '1')
  const composerRef = useRef(null)

  useEffect(() => {
    setShowComposer(searchParams.get('compose') === '1')
  }, [searchParams])

  useEffect(() => {
    if (!showComposer || !composerRef.current) return
    composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showComposer])

  async function loadPage() {
    setLoading(true)

    try {
      const [eventsPayload, picosPayload, optionsPayload] = await Promise.all([
        apiRequest('/api/events', { token }),
        apiRequest('/api/picos', { token }),
        apiRequest('/api/auth/options'),
      ])

      const visiblePicos = picosPayload.items.filter((item) => item.approvalStatus === 'approved')

      setItems(eventsPayload.items)
      setPicos(visiblePicos)
      setSports(optionsPayload.sports)
      setForm((current) => ({
        ...current,
        picoSlug: current.picoSlug || visiblePicos[0]?.slug || '',
        sportId: current.sportId || visiblePicos[0]?.sport?.id || optionsPayload.sports[0]?.id || '',
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

  const totals = useMemo(() => {
    return {
      total: items.length,
      sports: new Set(items.map((item) => item.sport?.slug).filter(Boolean)).size,
      prizePoolCents: sumPrizePool(items),
    }
  }, [items])

  async function handleCreateEvent(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const payload = await apiRequest(`/api/picos/${form.picoSlug}/events`, {
        method: 'POST',
        token,
        body: form,
      })
      setMessage(
        payload.item?.approvalStatus === 'approved'
          ? 'Evento publicado com sucesso.'
          : 'Evento enviado para aprovacao.',
      )
      setForm((current) => ({
        ...current,
        title: '',
        description: '',
        startsAt: '',
        entryFeeCents: 0,
        prizePoolCents: 0,
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

  function handlePicoChange(nextSlug) {
    const selectedPico = picos.find((item) => item.slug === nextSlug)
    setForm((current) => ({
      ...current,
      picoSlug: nextSlug,
      sportId: selectedPico?.sport?.id || current.sportId,
    }))
  }

  return (
    <section className="page-grid social-page">
      <div className="page-column page-column-main feed-column">
        <div className="toolbar-card compact-page-header">
          <div className="section-title compact-section-title">
            <div>
              <p className="eyebrow">PicoMap</p>
              <h1>Eventos</h1>
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
              {showComposer ? 'Fechar criacao' : 'Novo evento'}
            </button>
          </div>
          <div className="chip-row compact-chip-row">
            <span className="status-pill">{totals.total} eventos</span>
            <span className="status-pill">{totals.sports} esportes</span>
            <span className="status-pill">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 0,
              }).format(totals.prizePoolCents / 100)}
            </span>
          </div>
        </div>

        {showComposer ? (
          <div className="side-card compose-card" ref={composerRef}>
            <div className="section-title compact-section-title">
              <h2>{user?.permissions?.includes('event.approve') ? 'Criar evento' : 'Sugerir evento'}</h2>
            </div>

            {user ? (
              <form className="form-card compact-form" onSubmit={handleCreateEvent}>
                {!picos.length ? (
                  <p className="muted-text">Escolha um pico aprovado.</p>
                ) : null}
                <label>
                  Pico
                  <select value={form.picoSlug} onChange={(event) => handlePicoChange(event.target.value)}>
                    <option value="">Selecione</option>
                    {picos.map((pico) => (
                      <option key={pico.id} value={pico.slug}>
                        {pico.name}
                      </option>
                    ))}
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
                  Esporte
                  <select
                    value={form.sportId}
                    onChange={(event) => setForm((current) => ({ ...current, sportId: Number(event.target.value) }))}
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
                    value={form.startsAt}
                    onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                  />
                </label>

                <div className="two-column-grid">
                  <label>
                    Entrada
                    <input
                      value={form.entryFeeCents}
                      onChange={(event) => setForm((current) => ({ ...current, entryFeeCents: Number(event.target.value) }))}
                    />
                  </label>

                  <label>
                    Premio
                    <input
                      value={form.prizePoolCents}
                      onChange={(event) => setForm((current) => ({ ...current, prizePoolCents: Number(event.target.value) }))}
                    />
                  </label>
                </div>

                <label>
                  Descricao
                  <textarea
                    rows="3"
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  />
                </label>

                {message ? <p className="success-text">{message}</p> : null}

                <button className="primary-button full-width" disabled={saving || !form.picoSlug}>
                  {saving ? 'Enviando...' : user?.permissions?.includes('event.approve') ? 'Publicar evento' : 'Enviar para aprovacao'}
                </button>
              </form>
            ) : (
              <div className="empty-state">
                <p className="muted-text">Entre para criar eventos.</p>
                <Link className="primary-button small-link-button full-width" to="/entrar">
                  Entrar agora
                </Link>
              </div>
            )}
          </div>
        ) : null}

        {loading ? <div className="side-card">Carregando eventos...</div> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <div className="list-stack">
          {items.map((item) => (
            <article key={item.id} className="post-card">
              <div className="post-card-header">
                <div>
                  <p className="eyebrow">Evento do pico</p>
                  <h2>{item.title}</h2>
                </div>
                <span className="pill">{item.sport?.name}</span>
              </div>

              <div className="post-card-media post-card-media-muted">
                <MediaAsset
                  className="cover-thumb small-cover-thumb"
                  src={item.pico?.previewPhoto}
                  alt={item.pico?.name || item.title}
                />
              </div>

              <div className="post-card-body">
                <p>{item.description || 'Evento criado pela comunidade do pico.'}</p>
                <div className="meta-row wrap-actions">
                  <span>{formatDate(item.startsAt)}</span>
                  <span>{item.entryFeeLabel} entrada</span>
                  <span>{item.prizePoolLabel} premio</span>
                  {item.distanceLabel ? <span>{item.distanceLabel}</span> : null}
                  {item.approvalStatus !== 'approved' ? <span className="pill">Pendente</span> : null}
                </div>
              </div>

              <div className="post-card-footer">
                <div className="user-chip">
                  <div className="avatar-circle avatar-mini">
                    {getInitial(item.host?.displayName, 'P')}
                  </div>
                  <div>
                    <strong>{getDisplayName(item.host?.displayName, 'Comunidade')}</strong>
                    <p>{item.pico?.name}</p>
                  </div>
                </div>

                <div className="inline-actions">
                  {item.pico ? (
                    <Link className="secondary-button small-link-button" to={`/picos/${item.pico.slug}`}>
                      Abrir pico
                    </Link>
                  ) : null}
                  <Link className="primary-button small-link-button" to={`/eventos/${item.id}`}>
                    Ver detalhe
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
