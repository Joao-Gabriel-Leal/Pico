import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function EventDetailPage() {
  const { eventId } = useParams()
  const { token } = useAuth()
  const [item, setItem] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPage() {
      const payload = await apiRequest(`/api/events/${eventId}`, { token })
      setItem(payload.item)
    }

    loadPage().catch((nextError) => setError(nextError.message))
  }, [eventId, token])

  if (error && !item) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <h1>Evento nao encontrado</h1>
          <p className="error-text">{error}</p>
          <Link className="primary-button small-link-button" to="/eventos">
            Voltar
          </Link>
        </div>
      </section>
    )
  }

  if (!item) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <p className="muted-text">Carregando evento...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="simple-page">
      <div className="side-card event-detail-card">
        <div className="section-title">
          <div>
            <p className="eyebrow">Detalhe do evento</p>
            <h1>{item.title}</h1>
          </div>
          <span className="pill">{item.sport?.name}</span>
        </div>

        <MediaAsset className="cover-thumb" src={item.pico?.previewPhoto} alt={item.pico?.name || item.title} />

        <div className="stats-stack">
          <article>
            <span>Pico</span>
            <strong>{item.pico?.name}</strong>
          </article>
          <article>
            <span>Quando</span>
            <strong>{formatDate(item.startsAt)}</strong>
          </article>
          <article>
            <span>Distancia</span>
            <strong>{item.distanceLabel || 'Sem localizacao'}</strong>
          </article>
        </div>

        <p className="hero-copy">{item.description || 'Evento criado pela comunidade do pico.'}</p>

        <div className="meta-row wrap-actions">
          <span>{item.entryFeeLabel} entrada</span>
          <span>{item.prizePoolLabel} premio</span>
          <span>{item.host?.displayName || 'Comunidade'}</span>
        </div>

        <div className="inline-actions">
          {item.pico ? (
            <Link className="secondary-button small-link-button" to={`/picos/${item.pico.slug}`}>
              Abrir pico
            </Link>
          ) : null}
          <Link className="primary-button small-link-button" to="/eventos">
            Voltar para eventos
          </Link>
        </div>
      </div>
    </section>
  )
}
