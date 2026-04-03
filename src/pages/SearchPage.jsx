import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import { getDisplayName, getInitial } from '../utils/text'

export default function SearchPage() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [searchText, setSearchText] = useState('')
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState('')
  const [error, setError] = useState('')

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
      return displayName.includes(normalized) || username.includes(normalized) || bio.includes(normalized)
    })
  }, [people, searchText])

  async function handleToggleFollow(targetUserId) {
    setBusyUserId(targetUserId)
    setError('')

    try {
      const payload = await apiRequest(`/api/people/${targetUserId}/follow`, {
        method: 'POST',
        token,
      })
      setPeople((current) =>
        current.map((person) =>
          person.id === targetUserId
            ? {
                ...person,
                ...payload.item,
              }
            : person,
        ),
      )
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setBusyUserId('')
    }
  }

  async function handleMessage(targetUserId) {
    setBusyUserId(targetUserId)
    setError('')

    try {
      const payload = await apiRequest('/api/dms', {
        method: 'POST',
        token,
        body: { recipientUserId: targetUserId },
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
    <section className="search-page">
      <div className="search-page-header">
        <div>
          <p className="eyebrow">Comunidade</p>
          <h1>Buscar</h1>
        </div>
        <span className="status-pill">{filteredPeople.length}</span>
      </div>

      <input
        className="search-people-input"
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        placeholder="Buscar por nome ou usuario"
      />

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <div className="dark-empty-state">Carregando pessoas...</div> : null}

      <div className="search-people-list">
        {filteredPeople.map((person) => (
          <article key={person.id} className="search-person-row">
            <Link className="search-person-main" to={`/pessoas/${person.id}`}>
              {person.avatarUrl ? (
                <MediaAsset className="search-person-avatar" src={person.avatarUrl} alt={getDisplayName(person.displayName)} />
              ) : (
                <div className="avatar-circle search-person-avatar">
                  {getInitial(person.displayName)}
                </div>
              )}

              <div className="search-person-copy">
                <strong>{getDisplayName(person.displayName)}</strong>
                <p>@{person.username || 'picomap'}</p>
              </div>
            </Link>

            <div className="search-person-actions">
              {person.isMutual ? (
                <button
                  className="secondary-button small-link-button"
                  type="button"
                  disabled={busyUserId === person.id}
                  onClick={() => handleMessage(person.id)}
                >
                  {busyUserId === person.id ? '...' : 'Mensagem'}
                </button>
              ) : (
                <button
                  className={person.isFollowing ? 'secondary-button small-link-button' : 'primary-button small-link-button'}
                  type="button"
                  disabled={busyUserId === person.id}
                  onClick={() => handleToggleFollow(person.id)}
                >
                  {busyUserId === person.id ? '...' : person.isFollowing ? 'Seguindo' : 'Seguir'}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
