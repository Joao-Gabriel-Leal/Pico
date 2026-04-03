import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'

export default function SearchPage() {
  const navigate = useNavigate()
  const { user, token, refreshUser } = useAuth()
  const [searchText, setSearchText] = useState('')
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadPeople() {
    if (!token) return

    setLoading(true)

    try {
      const payload = await apiRequest('/api/people', { token })
      setPeople(payload.items || [])
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    loadPeople()
  }, [token])

  const filteredPeople = useMemo(() => {
    const normalized = searchText.trim().toLowerCase()
    if (!normalized) return people

    return people.filter((person) => {
      const displayName = person.displayName?.toLowerCase() || ''
      const username = person.username?.toLowerCase() || ''
      const bio = person.bio?.toLowerCase() || ''
      return (
        displayName.includes(normalized) ||
        username.includes(normalized) ||
        bio.includes(normalized)
      )
    })
  }, [people, searchText])

  async function handleToggleFollow(targetUserId) {
    setBusyUserId(targetUserId)
    setError('')
    setMessage('')

    try {
      await apiRequest(`/api/people/${targetUserId}/follow`, {
        method: 'POST',
        token,
      })
      await refreshUser()
      await loadPeople()
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setBusyUserId('')
    }
  }

  async function handleMessage(targetUserId) {
    setBusyUserId(targetUserId)
    setError('')
    setMessage('')

    try {
      const payload = await apiRequest('/api/dms', {
        method: 'POST',
        token,
        body: {
          recipientUserId: targetUserId,
        },
      })
      navigate(`/conversas?conversation=${payload.conversation.id}`)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setBusyUserId('')
    }
  }

  if (!user) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <h1>Entre para buscar pessoas</h1>
          <Link className="primary-button small-link-button" to="/entrar">
            Entrar agora
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
              <p className="eyebrow">Comunidade</p>
              <h1>Buscar</h1>
            </div>
            <span className="status-pill">{filteredPeople.length}</span>
          </div>
          <div className="search-input-shell">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Nome, usuario ou bio"
            />
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
        {loading ? <div className="side-card">Carregando pessoas...</div> : null}

        <div className="list-stack">
          {filteredPeople.length ? (
            filteredPeople.map((person) => (
              <article key={person.id} className="post-card search-result-card compact-search-card">
                <Link className="search-result-main" to={`/pessoas/${person.id}`}>
                  <div className="user-chip search-user-chip">
                    {person.avatarUrl ? (
                      <MediaAsset className="avatar-circle avatar-mini" src={person.avatarUrl} alt={person.displayName} />
                    ) : (
                      <div className="avatar-circle avatar-mini">{person.displayName.slice(0, 1).toUpperCase()}</div>
                    )}
                    <div>
                      <strong>{person.displayName}</strong>
                      <p>@{person.username}</p>
                      {person.bio ? <span className="person-bio-line">{person.bio}</span> : null}
                    </div>
                  </div>
                  <div className="search-result-meta">
                    <span>{person.mediaCount} posts</span>
                    <span>{person.followerCount} seg</span>
                  </div>
                </Link>

                <div className="search-result-actions">
                  <button
                    className={person.isFollowing ? 'secondary-button small-link-button' : 'primary-button small-link-button'}
                    type="button"
                    disabled={busyUserId === person.id}
                    onClick={() => handleToggleFollow(person.id)}
                  >
                    {busyUserId === person.id ? '...' : person.isFollowing ? 'Seguindo' : 'Seguir'}
                  </button>
                  <button
                    className="secondary-button small-link-button"
                    type="button"
                    disabled={busyUserId === person.id}
                    onClick={() => handleMessage(person.id)}
                  >
                    DM
                  </button>
                </div>

                {(person.favoriteSports || []).length ? (
                  <div className="chip-row compact-chip-row">
                    {(person.favoriteSports || []).slice(0, 2).map((sport) => (
                      <span key={sport.id} className="pill">
                        {sport.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="side-card empty-state">
              <p className="muted-text">Nenhum perfil encontrado com esse termo.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
