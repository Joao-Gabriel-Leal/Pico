import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import { getDisplayName, getInitial } from '../utils/text'

function formatRelativeDate(value) {
  const date = new Date(value)
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

  const units = [
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ]

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size || unit === 'minute') {
      return formatter.format(Math.round(seconds / size), unit)
    }
  }

  return formatter.format(seconds, 'second')
}

export default function NotificationsPage() {
  const { token, user } = useAuth()
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadPage() {
    setLoading(true)

    try {
      const payload = await apiRequest('/api/notifications', { token })
      setItems(payload.items || [])
      setUnreadCount(payload.unreadCount || 0)
      window.dispatchEvent(
        new CustomEvent('notifications:updated', { detail: { unreadCount: payload.unreadCount || 0 } }),
      )

      if (payload.unreadCount) {
        const nextPayload = await apiRequest('/api/notifications/read', {
          method: 'POST',
          token,
          body: {},
        })
        setItems(nextPayload.items || [])
        setUnreadCount(nextPayload.unreadCount || 0)
        window.dispatchEvent(
          new CustomEvent('notifications:updated', { detail: { unreadCount: nextPayload.unreadCount || 0 } }),
        )
      }
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    loadPage()
  }, [token])

  const groups = useMemo(() => {
    const unread = items.filter((item) => !item.isRead)
    const earlier = items.filter((item) => item.isRead)
    return { unread, earlier }
  }, [items])

  if (!user) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <h1>Entre para ver atividade</h1>
          <Link className="primary-button small-link-button" to="/entrar">
            Entrar
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page-grid social-page">
      <div className="page-column page-column-main feed-column">
        <div className="toolbar-card compact-page-header">
          <div className="section-title compact-section-title">
            <div>
              <p className="eyebrow">Atividade</p>
              <h1>Notificacoes</h1>
            </div>
            <span className="status-pill">{unreadCount} novas</span>
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {loading ? <div className="side-card">Carregando atividade...</div> : null}

        {!loading && !items.length ? (
          <div className="side-card empty-state">
            <p className="muted-text">Sua atividade vai aparecer aqui.</p>
          </div>
        ) : null}

        {groups.unread.length ? (
          <div className="notification-group">
            <div className="section-title compact-section-title">
              <h2>Novas</h2>
            </div>
            <div className="list-stack compact-list">
              {groups.unread.map((item) => (
                <Link key={item.id} className="notification-item list-item" to={item.targetPath}>
                  <div className="user-chip">
                    {item.actor.avatarUrl ? (
                      <MediaAsset className="avatar-circle avatar-mini" src={item.actor.avatarUrl} alt={getDisplayName(item.actor.displayName)} />
                    ) : (
                      <div className="avatar-circle avatar-mini">{getInitial(item.actor.displayName)}</div>
                    )}
                    <div className="notification-copy">
                      <p>
                        <strong>{getDisplayName(item.actor.displayName)}</strong> {item.text}
                      </p>
                      {item.secondaryText ? <span>{item.secondaryText}</span> : null}
                    </div>
                  </div>
                  <div className="notification-meta">
                    {item.previewImageUrl ? (
                      <MediaAsset className="notification-preview" src={item.previewImageUrl} alt="" />
                    ) : null}
                    <span>{formatRelativeDate(item.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {groups.earlier.length ? (
          <div className="notification-group">
            <div className="section-title compact-section-title">
              <h2>Anteriores</h2>
            </div>
            <div className="list-stack compact-list">
              {groups.earlier.map((item) => (
                <Link key={item.id} className="notification-item list-item" to={item.targetPath}>
                  <div className="user-chip">
                    {item.actor.avatarUrl ? (
                      <MediaAsset className="avatar-circle avatar-mini" src={item.actor.avatarUrl} alt={getDisplayName(item.actor.displayName)} />
                    ) : (
                      <div className="avatar-circle avatar-mini">{getInitial(item.actor.displayName)}</div>
                    )}
                    <div className="notification-copy">
                      <p>
                        <strong>{getDisplayName(item.actor.displayName)}</strong> {item.text}
                      </p>
                      {item.secondaryText ? <span>{item.secondaryText}</span> : null}
                    </div>
                  </div>
                  <div className="notification-meta">
                    {item.previewImageUrl ? (
                      <MediaAsset className="notification-preview" src={item.previewImageUrl} alt="" />
                    ) : null}
                    <span>{formatRelativeDate(item.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
