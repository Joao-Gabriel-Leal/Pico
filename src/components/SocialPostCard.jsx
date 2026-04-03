import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api'
import MediaAsset from './MediaAsset'

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function SocialPostCard({
  item,
  token,
  currentUser,
  onUpdated,
  onDeleted,
  showPicoLink = true,
  autoPlayVideo = true,
}) {
  const [localItem, setLocalItem] = useState(item)
  const [commentText, setCommentText] = useState('')
  const [savingLike, setSavingLike] = useState(false)
  const [savingComment, setSavingComment] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sharingDm, setSharingDm] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [conversations, setConversations] = useState([])
  const [following, setFollowing] = useState([])
  const [shareTarget, setShareTarget] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setLocalItem(item)
  }, [item])

  const recentComments = useMemo(
    () => (Array.isArray(localItem.comments) ? localItem.comments.slice(-3) : []),
    [localItem.comments],
  )

  const shareUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return localItem.pico?.slug ? `${base}/picos/${localItem.pico.slug}#midia-${localItem.id}` : base
  }, [localItem.id, localItem.pico?.slug])

  async function handleLike() {
    if (!token || savingLike) return

    setSavingLike(true)
    setError('')

    try {
      const payload = await apiRequest(`/api/media/${localItem.id}/likes`, {
        method: 'POST',
        token,
      })
      setLocalItem(payload.item)
      onUpdated?.(payload.item)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSavingLike(false)
    }
  }

  async function handleCommentSubmit(event) {
    event.preventDefault()
    if (!token || savingComment || !commentText.trim()) return

    setSavingComment(true)
    setError('')

    try {
      const payload = await apiRequest(`/api/media/${localItem.id}/comments`, {
        method: 'POST',
        token,
        body: {
          text: commentText,
        },
      })
      setLocalItem(payload.item)
      setCommentText('')
      onUpdated?.(payload.item)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSavingComment(false)
    }
  }

  async function handleDelete() {
    if (!token || deleting) return

    setDeleting(true)
    setError('')

    try {
      await apiRequest(`/api/media/${localItem.id}`, {
        method: 'DELETE',
        token,
      })
      onDeleted?.(localItem.id)
    } catch (nextError) {
      setError(nextError.message)
      setDeleting(false)
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setError('')
      setShowMenu(false)
    } catch {
      setError('Nao foi possivel copiar o link agora.')
    }
  }

  async function handleExternalShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: localItem.title,
          text: `Olha esse post do ${localItem.pico?.name || 'PicoLiga'}`,
          url: shareUrl,
        })
      } else {
        await handleCopyLink()
      }
      setShowMenu(false)
    } catch {}
  }

  async function loadConversationsForShare() {
    if (!token || (conversations.length && following.length)) return

    try {
      const payload = await apiRequest('/api/dms', { token })
      setConversations(payload.conversations || [])
      setFollowing(payload.following || [])

      if (payload.conversations?.[0]?.id) {
        setShareTarget(`conversation:${payload.conversations[0].id}`)
      } else if (payload.following?.[0]?.id) {
        setShareTarget(`user:${payload.following[0].id}`)
      } else {
        setShareTarget('')
      }
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleShareToDm() {
    if (!token || !shareTarget || sharingDm) return

    setSharingDm(true)
    setError('')

    try {
      let conversationId = ''
      const [targetType, targetId] = shareTarget.split(':')

      if (targetType === 'conversation') {
        conversationId = targetId
      }

      if (targetType === 'user') {
        const payload = await apiRequest('/api/dms', {
          method: 'POST',
          token,
          body: {
            recipientUserId: targetId,
          },
        })
        conversationId = payload.conversation.id
      }

      await apiRequest(`/api/dms/${conversationId}/messages`, {
        method: 'POST',
        token,
        body: {
          text: `Olha esse post: ${localItem.title}\n${shareUrl}`,
        },
      })
      setShowMenu(false)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSharingDm(false)
    }
  }

  return (
    <article className="post-card social-post-card" id={`midia-${localItem.id}`}>
      <div className="post-card-header">
        <div className="user-chip">
          {localItem.author?.avatarUrl ? (
            <MediaAsset
              className="avatar-circle avatar-mini"
              src={localItem.author.avatarUrl}
              alt={localItem.author.displayName}
            />
          ) : (
            <div className="avatar-circle avatar-mini">
              {(localItem.author?.displayName || 'P').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <strong>{localItem.author?.displayName || 'Comunidade'}</strong>
            <p>
              {localItem.pico?.name || 'Pico'} - {formatDate(localItem.createdAt)}
            </p>
          </div>
        </div>

        <div className="post-card-actions">
          <span className="pill">{localItem.mediaType === 'video' ? 'Video' : 'Foto'}</span>
          <button
            className="ghost-button small-button"
            type="button"
            onClick={async () => {
              setShowMenu((current) => !current)
              await loadConversationsForShare()
            }}
          >
            ...
          </button>
        </div>
      </div>

      {showMenu ? (
        <div className="post-menu">
          <button className="post-menu-button" type="button" onClick={handleExternalShare}>
            Compartilhar
          </button>
          <button className="post-menu-button" type="button" onClick={handleCopyLink}>
            Copiar link
          </button>
          {token && (conversations.length || following.length) ? (
            <div className="post-menu-share">
              <select value={shareTarget} onChange={(event) => setShareTarget(event.target.value)}>
                <option value="">Enviar por DM</option>
                {conversations.map((conversation) => (
                  <option key={conversation.id} value={`conversation:${conversation.id}`}>
                    DM com {conversation.otherUser?.displayName || 'Conversa'}
                  </option>
                ))}
                {following
                  .filter(
                    (person) =>
                      !conversations.some((conversation) => conversation.otherUser?.id === person.id),
                  )
                  .map((person) => (
                  <option key={person.id} value={`user:${person.id}`}>
                    Nova DM com {person.displayName}
                  </option>
                ))}
              </select>
              <button className="secondary-button small-link-button" type="button" onClick={handleShareToDm} disabled={!shareTarget || sharingDm}>
                {sharingDm ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          ) : null}
          {localItem.permissions?.canDelete ? (
            <button className="post-menu-button danger" type="button" onClick={handleDelete}>
              {deleting ? 'Removendo...' : 'Remover publicacao'}
            </button>
          ) : null}
        </div>
      ) : null}

      <MediaAsset
        className={localItem.mediaType === 'video' ? 'feed-video' : 'cover-thumb'}
        src={localItem.fileUrl}
        alt={localItem.title}
        mediaType={localItem.mediaType}
        autoPlayInView={localItem.mediaType === 'video' && autoPlayVideo}
        controls={localItem.mediaType !== 'video' || !autoPlayVideo}
      />

      <div className="post-card-body">
        <strong>{localItem.title}</strong>
        <div className="meta-row">
          <span>{localItem.likesCount} curtidas</span>
          <span>{localItem.commentsCount || localItem.comments?.length || 0} comentarios</span>
          <span>{localItem.viewsCount} views</span>
        </div>
        {Array.isArray(localItem.likedBy) && localItem.likedBy.length ? (
          <p className="liked-by-line">
            Curtido por{' '}
            <strong>
              {localItem.likedBy
                .slice(0, 3)
                .map((person) => person.displayName)
                .join(', ')}
            </strong>
          </p>
        ) : null}
      </div>

      <div className="post-action-row">
        <button
          className={localItem.isLiked ? 'post-action-button active' : 'post-action-button'}
          type="button"
          onClick={handleLike}
          disabled={!token || savingLike || !localItem.permissions?.canLike}
        >
          {localItem.isLiked ? 'Curtido' : 'Curtir'}
        </button>
        <button
          className="post-action-button"
          type="button"
          onClick={() => {
            setShowMenu(true)
            loadConversationsForShare()
          }}
        >
          Compartilhar
        </button>
        <span className="status-pill">{localItem.commentsCount || localItem.comments?.length || 0} comentarios</span>
        {showPicoLink && localItem.pico ? (
          <Link className="secondary-button small-link-button" to={`/picos/${localItem.pico.slug}`}>
            Abrir pico
          </Link>
        ) : null}
      </div>

      {recentComments.length ? (
        <div className="comment-stack">
          {recentComments.map((comment) => (
            <div key={comment.id} className="comment-card">
              <strong>{comment.author?.displayName || 'Comunidade'}</strong>
              <p>{comment.text}</p>
            </div>
          ))}
        </div>
      ) : null}

      {currentUser && localItem.permissions?.canComment ? (
        <form className="comment-form" onSubmit={handleCommentSubmit}>
          <input
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="Escreva um comentario..."
          />
          <button
            className="primary-button small-link-button"
            type="submit"
            disabled={savingComment || !commentText.trim()}
          >
            {savingComment ? 'Enviando...' : 'Comentar'}
          </button>
        </form>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
    </article>
  )
}
