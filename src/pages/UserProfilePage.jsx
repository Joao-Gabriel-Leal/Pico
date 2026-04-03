import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import SocialPostCard from '../components/SocialPostCard'

export default function UserProfilePage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { token, user, refreshUser } = useAuth()
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('posts')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadPage() {
    const payload = await apiRequest(`/api/people/${userId}`, { token })
    setDetail(payload)
  }

  useEffect(() => {
    loadPage().catch((nextError) => setError(nextError.message))
  }, [userId, token])

  const currentItems = useMemo(() => {
    if (!detail) return []
    if (tab === 'liked') return detail.likedPicos
    if (tab === 'following') return detail.followedPicos
    if (tab === 'visited') return detail.visitedPicos
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
        body: {
          recipientUserId: detail.person.id,
        },
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
    return <section className="simple-page"><div className="side-card"><p className="muted-text">Carregando perfil...</p></div></section>
  }

  return (
    <section className="page-grid social-page">
      <div className="page-column page-column-main feed-column">
        <div className="side-card instagram-profile-card">
          <div className="instagram-profile-main">
            {detail.person.avatarUrl ? (
              <MediaAsset className="instagram-avatar" src={detail.person.avatarUrl} alt={detail.person.displayName} />
            ) : (
              <div className="avatar-circle instagram-avatar">{detail.person.displayName.slice(0, 1).toUpperCase()}</div>
            )}
            <div className="instagram-profile-body">
              <div className="section-title">
                <div>
                  <h1>{detail.person.displayName}</h1>
                  <p className="muted-text">@{detail.person.username}</p>
                </div>
              </div>
              <div className="instagram-profile-counts">
                <article><strong>{detail.posts.length}</strong><span>posts</span></article>
                <article><strong>{detail.person.followerCount}</strong><span>seguidores</span></article>
                <article><strong>{detail.person.followingCount}</strong><span>seguindo</span></article>
              </div>
              <p className="hero-copy">{detail.person.bio || 'Sem bio por enquanto.'}</p>
              <div className="inline-actions wrap-actions">
                {user && user.id !== detail.person.id ? (
                  <button
                    className={detail.person.isFollowing ? 'secondary-button small-link-button' : 'primary-button small-link-button'}
                    type="button"
                    disabled={busy}
                    onClick={handleToggleFollow}
                  >
                    {busy ? 'Aguarde...' : detail.person.isFollowing ? 'Seguindo' : 'Seguir'}
                  </button>
                ) : null}
                {user && user.id !== detail.person.id ? (
                  <button className="secondary-button small-link-button" type="button" onClick={handleMessage}>
                    Mensagem
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="toolbar-card">
          <div className="chip-row">
            <button className={tab === 'posts' ? 'chip active' : 'chip'} onClick={() => setTab('posts')}>Posts</button>
            <button className={tab === 'liked' ? 'chip active' : 'chip'} onClick={() => setTab('liked')}>Curtiu</button>
            <button className={tab === 'following' ? 'chip active' : 'chip'} onClick={() => setTab('following')}>Segue</button>
            <button className={tab === 'visited' ? 'chip active' : 'chip'} onClick={() => setTab('visited')}>Ja andou</button>
          </div>
        </div>

        {tab === 'posts' ? (
          <div className="list-stack">
            {currentItems.length ? currentItems.map((item) => (
              <SocialPostCard key={item.id} item={item} token={token} currentUser={user} />
            )) : <div className="side-card empty-state"><p className="muted-text">Ainda nao ha publicacoes nesse perfil.</p></div>}
          </div>
        ) : (
          <div className="list-stack">
            {currentItems.length ? currentItems.map((item) => (
              <Link key={item.id} className="list-item" to={`/picos/${item.slug}`}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.sport?.name}</p>
                </div>
                <span>{item.voteCount} curtidas</span>
              </Link>
            )) : <div className="side-card empty-state"><p className="muted-text">Nada para mostrar nessa aba ainda.</p></div>}
          </div>
        )}
      </div>
    </section>
  )
}
