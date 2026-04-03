import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import PostDialog from '../components/PostDialog'
import { getDisplayName, getInitial } from '../utils/text'

export default function UserProfilePage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { token, user, refreshUser } = useAuth()
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('posts')
  const [selectedPost, setSelectedPost] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function loadPage() {
    const payload = await apiRequest(`/api/people/${userId}`, { token })
    setDetail(payload)
    setSelectedPost((current) => current || payload.posts?.[0] || null)
  }

  useEffect(() => {
    loadPage().catch((nextError) => setError(nextError.message))
  }, [userId, token])

  const currentItems = useMemo(() => {
    if (!detail) return []
    if (tab === 'picos') return detail.followedPicos
    if (tab === 'visited') return detail.visitedPicos
    if (tab === 'liked') return detail.likedPicos
    return detail.posts
  }, [detail, tab])

  async function handleToggleFollow() {
    if (!token || !detail) return

    setBusy(true)
    setError('')

    try {
      await apiRequest(`/api/people/${detail.person.id}/follow`, { method: 'POST', token })
      await refreshUser()
      await loadPage()
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleMessage() {
    if (!token || !detail) return

    setBusy(true)
    setError('')

    try {
      const payload = await apiRequest('/api/dms', {
        method: 'POST',
        token,
        body: { recipientUserId: detail.person.id },
      })
      navigate(`/conversas?conversation=${payload.conversation.id}`)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setBusy(false)
    }
  }

  if (error && !detail) {
    return <section className="simple-page"><div className="side-card"><p className="error-text">{error}</p></div></section>
  }

  if (!detail) {
    return <section className="simple-page"><div className="dark-empty-state">Carregando perfil...</div></section>
  }

  return (
    <section className="profile-page instagram-like-page">
      <div className="profile-hero-card">
        <div className="profile-hero-top">
          <div className="profile-hero-avatar-block">
            {detail.person.avatarUrl ? (
              <MediaAsset className="profile-avatar-hero" src={detail.person.avatarUrl} alt={getDisplayName(detail.person.displayName)} />
            ) : (
              <div className="avatar-circle profile-avatar-hero">
                {getInitial(detail.person.displayName)}
              </div>
            )}
          </div>

          <div className="profile-hero-main">
            <div className="profile-identity-row">
              <div>
                <h1>{getDisplayName(detail.person.displayName)}</h1>
                <p>@{detail.person.username || 'picomap'}</p>
              </div>
            </div>

            <div className="profile-count-strip">
              <article>
                <strong>{detail.posts.length}</strong>
                <span>posts</span>
              </article>
              <article>
                <strong>{detail.person.followerCount}</strong>
                <span>seguidores</span>
              </article>
              <article>
                <strong>{detail.person.followingCount}</strong>
                <span>seguindo</span>
              </article>
            </div>

            <div className="profile-bio-block">
              <strong>{getDisplayName(detail.person.displayName)}</strong>
              {detail.person.bio ? <p>{detail.person.bio}</p> : null}
            </div>

            {user && user.id !== detail.person.id ? (
              <div className="profile-primary-actions">
                <button
                  className={detail.person.isFollowing ? 'secondary-button small-link-button' : 'primary-button small-link-button'}
                  type="button"
                  disabled={busy}
                  onClick={handleToggleFollow}
                >
                  {busy ? 'Aguarde...' : detail.person.isFollowing ? 'Seguindo' : 'Seguir'}
                </button>
                {detail.person.isMutual ? (
                  <button className="secondary-button small-link-button" type="button" disabled={busy} onClick={handleMessage}>
                    Mensagem
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="profile-tab-bar">
        <button className={tab === 'posts' ? 'profile-tab active' : 'profile-tab'} type="button" onClick={() => setTab('posts')}>
          Posts
        </button>
        <button className={tab === 'picos' ? 'profile-tab active' : 'profile-tab'} type="button" onClick={() => setTab('picos')}>
          Picos
        </button>
        <button className={tab === 'visited' ? 'profile-tab active' : 'profile-tab'} type="button" onClick={() => setTab('visited')}>
          Andei
        </button>
        <button className={tab === 'liked' ? 'profile-tab active' : 'profile-tab'} type="button" onClick={() => setTab('liked')}>
          Curti
        </button>
      </div>

      {tab === 'posts' ? (
        <div className="profile-posts-grid">
          {currentItems.length ? (
            currentItems.map((item) => (
              <button key={item.id} className="profile-post-tile" type="button" onClick={() => setSelectedPost(item)}>
                <MediaAsset
                  className="profile-post-thumb"
                  src={item.fileUrl}
                  alt={item.title}
                  mediaType={item.mediaType}
                  controls={false}
                />
                {item.mediaType === 'video' ? <span className="profile-post-badge">video</span> : null}
              </button>
            ))
          ) : (
            <div className="dark-empty-state">Nenhuma publicacao ainda.</div>
          )}
        </div>
      ) : (
        <div className="profile-pico-list">
          {currentItems.length ? (
            currentItems.map((item) => (
              <Link key={item.id} className="profile-pico-row" to={`/picos/${item.slug}`}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.sport?.name}</p>
                </div>
                <span>{item.voteCount} curtidas</span>
              </Link>
            ))
          ) : (
            <div className="dark-empty-state">Nada nesta aba ainda.</div>
          )}
        </div>
      )}

      {error ? <p className="error-text">{error}</p> : null}

      <PostDialog
        item={selectedPost}
        token={token}
        currentUser={user}
        onClose={() => setSelectedPost(null)}
        onUpdated={(updatedItem) =>
          setDetail((current) =>
            current
              ? {
                  ...current,
                  posts: current.posts.map((item) => (item.id === updatedItem.id ? { ...item, ...updatedItem } : item)),
                }
              : current,
          )
        }
        onDeleted={(mediaId) => {
          setDetail((current) =>
            current
              ? {
                  ...current,
                  posts: current.posts.filter((item) => item.id !== mediaId),
                }
              : current,
          )
          setSelectedPost((current) => (current?.id === mediaId ? null : current))
        }}
      />
    </section>
  )
}
