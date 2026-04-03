import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'

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

  async function loadPage() {
    setLoading(true)

    try {
      const [eventsPayload, picosPayload, optionsPayload] = await Promise.all([
        apiRequest('/api/events', { token }),
        apiRequest('/api/picos', { token }),
        apiRequest('/api/auth/options'),
      ])

      setItems(eventsPayload.items)
      setPicos(picosPayload.items)
      setSports(optionsPayload.sports)
      setForm((current) => ({
        ...current,
        picoSlug: current.picoSlug || picosPayload.items[0]?.slug || '',
        sportId: current.sportId || picosPayload.items[0]?.sport?.id || optionsPayload.sports[0]?.id || '',
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
      await apiRequest(`/api/picos/${form.picoSlug}/events`, {
        method: 'POST',
        token,
        body: form,
      })
      setMessage('Evento publicado com sucesso.')
      setForm((current) => ({
        ...current,
        title: '',
        description: '',
        startsAt: '',
        entryFeeCents: 0,
        prizePoolCents: 0,
      }))
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
        <div className="hero-card social-hero-card">
          <div>
            <p className="eyebrow">Eventos e campeonatos</p>
            <h1>Uma agenda viva dos picos, pronta para abrir e entrar.</h1>
            <p className="hero-copy">
              Aqui fica a timeline de amistosos, campeonatos valendo grana de vaquinha e encontros
              da comunidade.
            </p>
          </div>

          <div className="stats-stack inline-stats">
            <article>
              <span>Eventos</span>
              <strong>{totals.total}</strong>
            </article>
            <article>
              <span>Esportes</span>
              <strong>{totals.sports}</strong>
            </article>
            <article>
              <span>Premiacao</span>
              <strong>
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                }).format(totals.prizePoolCents / 100)}
              </strong>
            </article>
          </div>
        </div>

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
                  className="cover-thumb"
                  src={item.pico?.previewPhoto}
                  alt={item.pico?.name || item.title}
                />
              </div>

              <div className="post-card-body">
                <p>{item.description || 'Evento criado pela comunidade do pico.'}</p>
                <div className="meta-row">
                  <span>{formatDate(item.startsAt)}</span>
                  <span>{item.entryFeeLabel} entrada</span>
                  <span>{item.prizePoolLabel} premio</span>
                </div>
              </div>

              <div className="post-card-footer">
                <div className="user-chip">
                  <div className="avatar-circle avatar-mini">
                    {(item.host?.displayName || 'P').slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <strong>{item.host?.displayName || 'Comunidade'}</strong>
                    <p>{item.pico?.name}</p>
                  </div>
                </div>

                {item.pico ? (
                  <Link className="secondary-button small-link-button" to={`/picos/${item.pico.slug}`}>
                    Abrir pico
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className="page-column rail-column">
        <div className="side-card sticky-card">
          <div className="section-title">
            <h2>Criar evento</h2>
            <span>estilo feed</span>
          </div>

          {user ? (
            <form className="form-card compact-form" onSubmit={handleCreateEvent}>
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
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sportId: Number(event.target.value) }))
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
                  value={form.startsAt}
                  onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                />
              </label>

              <div className="two-column-grid">
                <label>
                  Entrada
                  <input
                    value={form.entryFeeCents}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        entryFeeCents: Number(event.target.value),
                      }))
                    }
                  />
                </label>

                <label>
                  Premio
                  <input
                    value={form.prizePoolCents}
                    onChange={(event) =>
                      setForm((current) => ({
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
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>

              {message ? <p className="success-text">{message}</p> : null}

              <button className="primary-button full-width" disabled={saving || !form.picoSlug}>
                {saving ? 'Publicando...' : 'Publicar evento'}
              </button>
            </form>
          ) : (
            <div className="empty-state">
              <p className="muted-text">Entre para publicar amistosos, campeonatos e encontros.</p>
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
