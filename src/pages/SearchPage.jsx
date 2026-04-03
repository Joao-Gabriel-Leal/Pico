import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'

export default function SearchPage() {
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
      await apiRequest('/api/dms', {
        method: 'POST',
        token,
        body: {
          recipientUserId: targetUserId,
        },
      })
      setMessage('Conversa aberta na aba de DM.')
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
          <h1>Entre para pesquisar pessoas</h1>
          <p className="muted-text">
            A busca serve para achar perfis do app, seguir e abrir conversa.
          </p>
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
        <div className="hero-card social-hero-card">
          <div>
            <p className="eyebrow">Pesquisar pessoas</p>
            <h1>Encontre usuarios do app para seguir, ver perfil e puxar conversa.</h1>
            <p className="hero-copy">
              Essa aba agora centraliza descoberta da comunidade antes da DM e do feed.
            </p>
          </div>

          <div className="search-input-shell">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar por nome, usuario ou bio"
            />
            <span className="status-pill">{filteredPeople.length} resultados</span>
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
        {loading ? <div className="side-card">Carregando pessoas...</div> : null}

        <div className="list-stack">
          {filteredPeople.length ? (
            filteredPeople.map((person) => (
              <article key={person.id} className="post-card search-result-card">
                <div className="post-card-header">
                  <div className="user-chip">
                    {person.avatarUrl ? (
                      <MediaAsset className="avatar-circle avatar-mini" src={person.avatarUrl} alt={person.displayName} />
                    ) : (
                      <div className="avatar-circle avatar-mini">{person.displayName.slice(0, 1).toUpperCase()}</div>
                    )}
                    <div>
                      <strong>{person.displayName}</strong>
                      <p>@{person.username}</p>
                    </div>
                  </div>
                  <span className="status-pill">{person.mediaCount} posts</span>
                </div>

                <div className="post-card-body">
                  <p>{person.bio || 'Sem bio ainda.'}</p>
                  <div className="meta-row wrap-actions">
                    <span>{person.followerCount} seguidores</span>
                    <span>{person.followingCount} seguindo</span>
                    {person.isFollowing ? <span className="pill">Voce segue</span> : null}
                  </div>
                </div>

                <div className="post-card-footer">
                  <div className="chip-row">
                    {(person.favoriteSports || []).slice(0, 3).map((sport) => (
                      <span key={sport.id} className="pill">
                        {sport.name}
                      </span>
                    ))}
                  </div>

                  <div className="inline-actions wrap-actions">
                    <Link className="secondary-button small-link-button" to={`/pessoas/${person.id}`}>
                      Perfil
                    </Link>
                    <button
                      className={person.isFollowing ? 'secondary-button small-link-button' : 'primary-button small-link-button'}
                      type="button"
                      disabled={busyUserId === person.id}
                      onClick={() => handleToggleFollow(person.id)}
                    >
                      {busyUserId === person.id ? 'Aguarde...' : person.isFollowing ? 'Seguindo' : 'Seguir'}
                    </button>
                    <button
                      className="secondary-button small-link-button"
                      type="button"
                      disabled={busyUserId === person.id}
                      onClick={() => handleMessage(person.id)}
                    >
                      Mensagem
                    </button>
                  </div>
                </div>
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
