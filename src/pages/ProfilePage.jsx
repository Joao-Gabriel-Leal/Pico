import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import SportPicker from '../components/SportPicker'
import { uploadSelectedFile } from '../utils/files'
import { formatLocation, getCurrentPosition } from '../utils/geo'

function toggleId(list, id) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

export default function ProfilePage() {
  const { user, token, refreshUser } = useAuth()
  const [sports, setSports] = useState([])
  const [feedItems, setFeedItems] = useState([])
  const [people, setPeople] = useState([])
  const [saving, setSaving] = useState(false)
  const [capturingLocation, setCapturingLocation] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    avatarUrl: '',
    location: null,
    favoriteSportIds: [],
  })

  async function loadPage() {
    if (!token) return

    const [optionsPayload, feedPayload, peoplePayload] = await Promise.all([
      apiRequest('/api/auth/options'),
      apiRequest('/api/feed?authorId=me', { token }),
      apiRequest('/api/people', { token }),
    ])

    setSports(optionsPayload.sports)
    setFeedItems(feedPayload.items)
    setPeople(peoplePayload.items)
  }

  useEffect(() => {
    if (!token) return
    loadPage().catch((nextError) => setError(nextError.message))
  }, [token])

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

  async function captureLocation() {
    setCapturingLocation(true)
    setError('')

    try {
      const location = await getCurrentPosition()
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
      const uploadedUrl = await uploadSelectedFile(file, {
        token,
        kind: 'image',
      })
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
      setMessage('Perfil atualizado com sucesso.')
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleFollow(targetUserId) {
    setError('')

    try {
      await apiRequest(`/api/people/${targetUserId}/follow`, {
        method: 'POST',
        token,
      })
      await refreshUser()
      await loadPage()
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  if (!user) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <h1>Entre para editar seu perfil</h1>
          <p className="muted-text">
            O perfil agora mostra seguidores, seguindo e seus posts no feed.
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
        <div className="side-card">
          <div className="profile-hero">
            <div className="profile-hero-media">
              {form.avatarUrl ? (
                <MediaAsset className="profile-avatar-large" src={form.avatarUrl} alt={user.displayName} />
              ) : (
                <div className="avatar-circle profile-avatar-large">{user.displayName.slice(0, 1).toUpperCase()}</div>
              )}
            </div>

            <div className="profile-hero-body">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Seu perfil</p>
                  <h1>{user.displayName}</h1>
                </div>
                <span className="status-pill">@{user.username}</span>
              </div>

              <div className="profile-counts">
                <article>
                  <strong>{user.mediaCount}</strong>
                  <span>Posts</span>
                </article>
                <article>
                  <strong>{user.followerCount}</strong>
                  <span>Seguidores</span>
                </article>
                <article>
                  <strong>{user.followingCount}</strong>
                  <span>Seguindo</span>
                </article>
              </div>

              <p className="hero-copy">{form.bio || 'Complete sua bio e comece a postar seus picos.'}</p>
              <p className="muted-text">{formatLocation(form.location)}</p>
            </div>
          </div>
        </div>

        <div className="side-card">
          <div className="section-title">
            <h2>Editar perfil</h2>
            <span>{user.createdPicoCount} picos criados</span>
          </div>

          <form className="form-card" onSubmit={handleSubmit}>
            <label>
              Nome exibido
              <input
                value={form.displayName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, displayName: event.target.value }))
                }
              />
            </label>

            <div className="location-box">
              <div>
                <strong>Sua localizacao exata</strong>
                <p>{formatLocation(form.location)}</p>
              </div>
              <button className="secondary-button" type="button" onClick={captureLocation}>
                {capturingLocation ? 'Atualizando...' : 'Atualizar localizacao'}
              </button>
            </div>

            <label>
              Foto de perfil
              <input type="file" accept="image/*" onChange={handleAvatarChange} />
            </label>

            <label>
              Bio
              <textarea
                rows="4"
                value={form.bio}
                onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              />
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
                helperText="Escolha quantos esportes fizer sentido para voce. Isso pode ser alterado a qualquer momento."
              />
            </div>

            {error ? <p className="error-text">{error}</p> : null}
            {message ? <p className="success-text">{message}</p> : null}

            <button
              className="primary-button full-width"
              disabled={saving || uploadingAvatar || !form.location}
            >
              {saving ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </form>
        </div>

        <div className="section-title">
          <h2>Seus posts no feed</h2>
          <span>{feedItems.length}</span>
        </div>

        <div className="list-stack">
          {feedItems.length ? (
            feedItems.map((item) => (
              <article key={item.id} className="post-card">
                <div className="post-card-header">
                  <div className="user-chip">
                    <div className="avatar-circle avatar-mini">{user.displayName.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <strong>{user.displayName}</strong>
                      <p>{item.pico?.name}</p>
                    </div>
                  </div>
                  <span className="pill">{item.mediaType === 'video' ? 'Video' : 'Foto'}</span>
                </div>

                <MediaAsset
                  className={item.mediaType === 'video' ? 'feed-video' : 'cover-thumb'}
                  src={item.fileUrl}
                  alt={item.title}
                  mediaType={item.mediaType}
                />

                <div className="post-card-body">
                  <strong>{item.title}</strong>
                  <div className="meta-row">
                    <span>{item.likesCount} likes</span>
                    <span>{item.viewsCount} views</span>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="side-card empty-state">
              <p className="muted-text">
                Seus uploads de foto e video vao aparecer aqui quando voce postar em um pico.
              </p>
            </div>
          )}
        </div>
      </div>

      <aside className="page-column rail-column">
        <div className="side-card sticky-card">
          <div className="section-title">
            <h2>Pessoas no app</h2>
            <span>{people.length}</span>
          </div>

          <div className="list-stack compact-list">
            {people.length ? (
              people.map((person) => (
                <article key={person.id} className="list-item static-item follow-card">
                  <div className="user-chip">
                    {person.avatarUrl ? (
                      <MediaAsset className="avatar-circle avatar-mini" src={person.avatarUrl} alt={person.displayName} />
                    ) : (
                      <div className="avatar-circle avatar-mini">{person.displayName.slice(0, 1).toUpperCase()}</div>
                    )}
                    <div>
                      <strong>{person.displayName}</strong>
                      <p>
                        {person.followerCount} seguidores • {person.mediaCount} posts
                      </p>
                    </div>
                  </div>

                  <button
                    className={person.isFollowing ? 'secondary-button small-link-button' : 'primary-button small-link-button'}
                    type="button"
                    onClick={() => handleToggleFollow(person.id)}
                  >
                    {person.isFollowing ? 'Seguindo' : 'Seguir'}
                  </button>
                </article>
              ))
            ) : (
              <p className="muted-text">Quando outros usuarios entrarem, eles aparecem aqui.</p>
            )}
          </div>
        </div>
      </aside>
    </section>
  )
}
