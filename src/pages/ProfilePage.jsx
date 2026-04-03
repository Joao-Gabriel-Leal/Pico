import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import SocialPostCard from '../components/SocialPostCard'
import SportPicker from '../components/SportPicker'
import { uploadSelectedFile } from '../utils/files'
import { formatLocation, getCurrentPosition } from '../utils/geo'

function toggleId(list, id) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

export default function ProfilePage() {
  const { user, token, refreshUser } = useAuth()
  const [sports, setSports] = useState([])
  const [roles, setRoles] = useState([])
  const [feedItems, setFeedItems] = useState([])
  const [people, setPeople] = useState([])
  const [moderation, setModeration] = useState({
    pendingPicos: [],
    pendingEvents: [],
  })
  const [saving, setSaving] = useState(false)
  const [capturingLocation, setCapturingLocation] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [moderating, setModerating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    avatarUrl: '',
    location: null,
    favoriteSportIds: [],
  })
  const canModerate = user?.permissions?.includes('pico.approve') || user?.permissions?.includes('event.approve')

  async function loadPage() {
    if (!token) return

    const requests = [
      apiRequest('/api/auth/options'),
      apiRequest('/api/feed?authorId=me&limit=12&offset=0', { token }),
      apiRequest('/api/people', { token }),
    ]

    if (canModerate) {
      requests.push(apiRequest('/api/moderation', { token }))
    }

    const [optionsPayload, feedPayload, peoplePayload, moderationPayload] = await Promise.all(requests)

    setSports(optionsPayload.sports)
    setRoles(optionsPayload.roles || [])
    setFeedItems(feedPayload.items)
    setPeople(peoplePayload.items)
    setModeration({
      pendingPicos: moderationPayload?.picos || [],
      pendingEvents: moderationPayload?.events || [],
    })
  }

  useEffect(() => {
    if (!token) return
    loadPage().catch((nextError) => setError(nextError.message))
  }, [token, canModerate])

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

  async function handleToggleRole(targetUserId, roleSlug, hasRole) {
    setError('')

    try {
      await apiRequest(
        hasRole ? `/api/users/${targetUserId}/roles/${roleSlug}` : `/api/users/${targetUserId}/roles`,
        {
          method: hasRole ? 'DELETE' : 'POST',
          token,
          body: hasRole ? undefined : { roleSlug },
        },
      )
      await refreshUser()
      await loadPage()
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleModerationAction(kind, targetId, action) {
    setError('')
    setMessage('')
    setModerating(true)

    try {
      const route =
        kind === 'pico'
          ? `/api/moderation/picos/${targetId}/${action}`
          : `/api/moderation/events/${targetId}/${action}`

      await apiRequest(route, {
        method: 'POST',
        token,
      })
      await loadPage()
      setMessage(action === 'approve' ? 'Item aprovado com sucesso.' : 'Item rejeitado.')
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setModerating(false)
    }
  }

  function handlePostUpdated(updatedItem) {
    setFeedItems((current) =>
      current.map((item) => (item.id === updatedItem.id ? { ...item, ...updatedItem } : item)),
    )
  }

  function handlePostDeleted(mediaId) {
    setFeedItems((current) => current.filter((item) => item.id !== mediaId))
  }

  if (!user) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <h1>Entre para editar seu perfil</h1>
          <p className="muted-text">
            O perfil agora mostra seguidores, seguindo, roles e seus posts no feed.
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

              {(user.roles || []).length ? (
                <div className="chip-row">
                  {user.roles.map((role) => (
                    <span key={role.slug} className="pill">
                      {role.name}
                    </span>
                  ))}
                </div>
              ) : null}

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

              <div className="inline-actions wrap-actions profile-action-row">
                <button
                  className="secondary-button small-link-button"
                  type="button"
                  onClick={() =>
                    document.getElementById('profile-edit-card')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }
                >
                  Editar perfil
                </button>
                <Link className="primary-button small-link-button" to="/feed?compose=1">
                  Nova publicacao
                </Link>
                <Link className="secondary-button small-link-button" to="/novo-pico">
                  Novo pico
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="side-card" id="profile-edit-card">
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
              <SocialPostCard
                key={item.id}
                item={item}
                token={token}
                currentUser={user}
                onUpdated={handlePostUpdated}
                onDeleted={handlePostDeleted}
              />
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
          {canModerate ? (
            <>
              <div className="section-title">
                <h2>Fila de moderacao</h2>
                <span>{moderation.pendingPicos.length + moderation.pendingEvents.length}</span>
              </div>

              <div className="list-stack compact-list">
                {moderation.pendingPicos.map((item) => (
                  <article key={item.id} className="list-item static-item">
                    <div>
                      <strong>{item.name}</strong>
                      <p>Pico aguardando aprovacao</p>
                    </div>
                    <div className="post-card-actions">
                      <Link className="secondary-button small-link-button" to={`/picos/${item.slug}`}>
                        Abrir
                      </Link>
                      <button
                        className="post-action-button active"
                        type="button"
                        disabled={moderating}
                        onClick={() => handleModerationAction('pico', item.slug, 'approve')}
                      >
                        Aprovar
                      </button>
                      <button
                        className="post-action-button"
                        type="button"
                        disabled={moderating}
                        onClick={() => handleModerationAction('pico', item.slug, 'reject')}
                      >
                        Rejeitar
                      </button>
                    </div>
                  </article>
                ))}

                {moderation.pendingEvents.map((item) => (
                  <article key={item.id} className="list-item static-item">
                    <div>
                      <strong>{item.title}</strong>
                      <p>Evento aguardando aprovacao</p>
                    </div>
                    <div className="post-card-actions">
                      <Link className="secondary-button small-link-button" to={`/eventos/${item.id}`}>
                        Abrir
                      </Link>
                      <button
                        className="post-action-button active"
                        type="button"
                        disabled={moderating}
                        onClick={() => handleModerationAction('evento', item.id, 'approve')}
                      >
                        Aprovar
                      </button>
                      <button
                        className="post-action-button"
                        type="button"
                        disabled={moderating}
                        onClick={() => handleModerationAction('evento', item.id, 'reject')}
                      >
                        Rejeitar
                      </button>
                    </div>
                  </article>
                ))}

                {!moderation.pendingPicos.length && !moderation.pendingEvents.length ? (
                  <p className="muted-text">Nada pendente na moderacao agora.</p>
                ) : null}
              </div>

              <div className="section-divider" />
            </>
          ) : null}

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
                        {person.followerCount} seguidores - {person.mediaCount} posts
                      </p>
                    </div>
                  </div>

                  <div className="follow-card-actions">
                    <button
                      className={person.isFollowing ? 'secondary-button small-link-button' : 'primary-button small-link-button'}
                      type="button"
                      onClick={() => handleToggleFollow(person.id)}
                    >
                      {person.isFollowing ? 'Seguindo' : 'Seguir'}
                    </button>

                    {(person.roles || []).length ? (
                      <div className="chip-row role-chip-row">
                        {person.roles.map((role) => (
                          <span key={role.slug} className="pill">
                            {role.name}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {user.permissions?.includes('role.assign') ? (
                      <div className="role-toggle-grid">
                        {roles.map((role) => {
                          const hasRole = person.roles?.some((item) => item.slug === role.slug)
                          return (
                            <button
                              key={role.slug}
                              className={hasRole ? 'post-action-button active' : 'post-action-button'}
                              type="button"
                              onClick={() => handleToggleRole(person.id, role.slug, hasRole)}
                            >
                              {role.name}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="muted-text">Quando outros usuarios entrarem, eles aparecem aqui.</p>
            )}
          </div>

          {error ? <p className="error-text">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}
        </div>
      </aside>
    </section>
  )
}
