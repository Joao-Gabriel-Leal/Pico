import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import PostDialog from '../components/PostDialog'
import SportPicker from '../components/SportPicker'
import { uploadSelectedFile } from '../utils/files'
import { formatLocation, getCurrentPosition } from '../utils/geo'
import { getDisplayName, getInitial } from '../utils/text'

function toggleId(list, id) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

export default function ProfilePage() {
  const { user, token, refreshUser, logout } = useAuth()
  const [sports, setSports] = useState([])
  const [detail, setDetail] = useState(null)
  const [moderation, setModeration] = useState({ picos: [], events: [] })
  const [tab, setTab] = useState('posts')
  const [showEdit, setShowEdit] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  const [saving, setSaving] = useState(false)
  const [capturingLocation, setCapturingLocation] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    avatarUrl: '',
    location: null,
    favoriteSportIds: [],
  })

  const canModerate =
    user?.permissions?.includes('pico.approve') || user?.permissions?.includes('event.approve')

  async function loadPage() {
    if (!token || !user) return

    const requests = [
      apiRequest('/api/auth/options'),
      apiRequest(`/api/people/${user.id}`, { token }),
    ]

    if (canModerate) {
      requests.push(apiRequest('/api/moderation', { token }))
    }

    const [optionsPayload, profilePayload, moderationPayload] = await Promise.all(requests)
    setSports(optionsPayload.sports || [])
    setDetail(profilePayload)
    setModeration(moderationPayload || { picos: [], events: [] })
  }

  useEffect(() => {
    if (!token || !user) return
    loadPage().catch((nextError) => setError(nextError.message))
  }, [token, user?.id, canModerate])

  useEffect(() => {
    if (!user) return
    setForm({
      displayName: user.displayName,
      bio: user.bio || '',
      avatarUrl: user.avatarUrl || '',
      location: user.location || null,
      favoriteSportIds: user.favoriteSportIds || [],
    })
  }, [user])

  const currentItems = useMemo(() => {
    if (!detail) return []
    if (tab === 'picos') return detail.followedPicos
    if (tab === 'visited') return detail.visitedPicos
    if (tab === 'liked') return detail.likedPicos
    return detail.posts
  }, [detail, tab])

  async function captureLocation() {
    setCapturingLocation(true)
    setError('')

    try {
      const location = await getCurrentPosition({ force: true })
      setForm((current) => ({ ...current, location }))
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setCapturingLocation(false)
    }
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    setError('')

    try {
      const uploadedUrl = await uploadSelectedFile(file, { token, kind: 'image' })
      setForm((current) => ({ ...current, avatarUrl: uploadedUrl }))
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      await apiRequest('/api/me', {
        method: 'PUT',
        token,
        body: form,
      })
      await refreshUser()
      await loadPage()
      setShowEdit(false)
      setMessage('Perfil atualizado.')
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleShareProfile() {
    const url = `${window.location.origin}/pessoas/${user.id}`

    try {
      if (navigator.share) {
        await navigator.share({
          title: form.displayName || user.displayName,
          text: `Perfil no PicoHunter`,
          url,
        })
      } else {
        await navigator.clipboard.writeText(url)
      }
      setMessage('Perfil compartilhado.')
    } catch {
      setError('Nao foi possivel compartilhar o perfil agora.')
    }
  }

  async function handleModerationAction(kind, targetId, action) {
    setError('')
    setMessage('')

    try {
      const route =
        kind === 'pico'
          ? `/api/moderation/picos/${targetId}/${action}`
          : `/api/moderation/events/${targetId}/${action}`
      await apiRequest(route, { method: 'POST', token })
      await loadPage()
      setMessage(action === 'approve' ? 'Aprovado.' : 'Rejeitado.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  function handlePostUpdated(updatedItem) {
    setDetail((current) =>
      current
        ? {
            ...current,
            posts: current.posts.map((item) => (item.id === updatedItem.id ? { ...item, ...updatedItem } : item)),
          }
        : current,
    )
    setSelectedPost((current) => (current?.id === updatedItem.id ? { ...current, ...updatedItem } : current))
  }

  function handlePostDeleted(mediaId) {
    setDetail((current) =>
      current
        ? {
            ...current,
            posts: current.posts.filter((item) => item.id !== mediaId),
          }
        : current,
    )
    setSelectedPost((current) => (current?.id === mediaId ? null : current))
  }

  if (!user) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <h1>Entre para abrir seu perfil</h1>
          <Link className="primary-button small-link-button" to="/entrar">
            Entrar agora
          </Link>
        </div>
      </section>
    )
  }

  if (!detail) {
    return <section className="simple-page"><div className="dark-empty-state">Carregando perfil...</div></section>
  }

  return (
    <section className="profile-page instagram-like-page">
      <div className="profile-hero-card">
        <div className="profile-hero-top">
          <div className="profile-hero-avatar-block">
            {form.avatarUrl ? (
              <MediaAsset className="profile-avatar-hero" src={form.avatarUrl} alt={getDisplayName(form.displayName || user.displayName)} />
            ) : (
              <div className="avatar-circle profile-avatar-hero">
                {getInitial(form.displayName || user.displayName)}
              </div>
            )}
          </div>

          <div className="profile-hero-main">
            <div className="profile-identity-row">
              <div>
                <h1>{getDisplayName(form.displayName || user.displayName)}</h1>
                <p>@{user.username}</p>
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
              <strong>{getDisplayName(form.displayName || user.displayName)}</strong>
              {form.bio ? <p>{form.bio}</p> : null}
              <span>{formatLocation(form.location)}</span>
            </div>

            <div className="profile-primary-actions">
              <button className="secondary-button small-link-button" type="button" onClick={() => setShowEdit((current) => !current)}>
                {showEdit ? 'Fechar' : 'Editar perfil'}
              </button>
              <button className="secondary-button small-link-button" type="button" onClick={handleShareProfile}>
                Compartilhar perfil
              </button>
              <button className="ghost-button small-button profile-inline-logout" type="button" onClick={logout}>
                Sair
              </button>
            </div>
          </div>
        </div>

        {showEdit ? (
          <form className="profile-edit-sheet" onSubmit={handleSubmit}>
            <label>
              Nome
              <input
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
              />
            </label>

            <label>
              Bio
              <textarea
                rows="3"
                value={form.bio}
                onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              />
            </label>

            <div className="location-box">
              <div>
                <strong>Localizacao</strong>
                <p>{formatLocation(form.location)}</p>
              </div>
              <button className="secondary-button" type="button" onClick={captureLocation}>
                {capturingLocation ? 'Atualizando...' : 'Atualizar'}
              </button>
            </div>

            <label>
              Foto de perfil
              <input type="file" accept="image/*" onChange={handleAvatarChange} />
            </label>

            <div>
              <label>Esportes favoritos</label>
              <SportPicker
                sports={sports}
                selectedIds={form.favoriteSportIds}
                onToggle={(sportId) =>
                  setForm((current) => ({
                    ...current,
                    favoriteSportIds: toggleId(current.favoriteSportIds, sportId),
                  }))
                }
                helperText=""
              />
            </div>

            {error ? <p className="error-text">{error}</p> : null}
            {message ? <p className="success-text">{message}</p> : null}

            <button className="primary-button full-width" disabled={saving || uploadingAvatar || !form.location}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        ) : null}
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

      {canModerate && (moderation.picos?.length || moderation.events?.length) ? (
        <div className="profile-moderation-panel">
          <div className="section-title compact-section-title">
            <h2>Moderacao</h2>
            <span>{(moderation.picos?.length || 0) + (moderation.events?.length || 0)}</span>
          </div>

          <div className="profile-pico-list">
            {(moderation.picos || []).map((item) => (
              <div key={item.id} className="profile-pico-row static-dark-row">
                <div>
                  <strong>{item.name}</strong>
                  <p>Pico pendente</p>
                </div>
                <div className="inline-actions wrap-actions">
                  <button className="secondary-button small-link-button" type="button" onClick={() => handleModerationAction('pico', item.slug, 'approve')}>
                    Aprovar
                  </button>
                  <button className="ghost-button small-button" type="button" onClick={() => handleModerationAction('pico', item.slug, 'reject')}>
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}

            {(moderation.events || []).map((item) => (
              <div key={item.id} className="profile-pico-row static-dark-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>Evento pendente</p>
                </div>
                <div className="inline-actions wrap-actions">
                  <button className="secondary-button small-link-button" type="button" onClick={() => handleModerationAction('event', item.id, 'approve')}>
                    Aprovar
                  </button>
                  <button className="ghost-button small-button" type="button" onClick={() => handleModerationAction('event', item.id, 'reject')}>
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="success-text">{message}</p> : null}

      <PostDialog
        item={selectedPost}
        token={token}
        currentUser={user}
        onClose={() => setSelectedPost(null)}
        onUpdated={handlePostUpdated}
        onDeleted={handlePostDeleted}
      />
    </section>
  )
}
