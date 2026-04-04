import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api'
import MediaAsset from './MediaAsset'
import ShareSheet from './ShareSheet'
import { CommentIcon, HeartIcon, MoreIcon, SendIcon, ShareIcon } from './AppIcons'
import { getDisplayName, getInitial } from '../utils/text'

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
  const [showMenu, setShowMenu] = useState(false)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const commentInputRef = useRef(null)

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
    setMessage('')

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
    setMessage('')

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
    setMessage('')

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
      setMessage('Link copiado.')
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
          text: `Olha esse drop do ${localItem.pico?.name || 'PicoHunter'}`,
          url: shareUrl,
        })
        setMessage('Compartilhado.')
      } else {
        await handleCopyLink()
      }
      setShowMenu(false)
    } catch {}
  }

  return (
    <>
      <article className="post-card social-post-card" id={`midia-${localItem.id}`}>
        <div className="post-card-header">
          {localItem.author?.id ? (
            <Link className="user-chip post-author-link" to={`/pessoas/${localItem.author.id}`}>
              {localItem.author?.avatarUrl ? (
                <MediaAsset
                  className="avatar-circle avatar-mini"
                  src={localItem.author.avatarUrl}
                  alt={getDisplayName(localItem.author?.displayName, 'Comunidade')}
                />
              ) : (
                <div className="avatar-circle avatar-mini">
                  {getInitial(localItem.author?.displayName, 'P')}
                </div>
              )}
              <div>
                <strong>{getDisplayName(localItem.author?.displayName, 'Comunidade')}</strong>
                <p>
                  @{localItem.author?.username || 'picohunter'} - {formatDate(localItem.createdAt)}
                </p>
              </div>
            </Link>
          ) : (
            <div className="user-chip post-author-link">
              <div className="avatar-circle avatar-mini">
                {getInitial(localItem.author?.displayName, 'P')}
              </div>
              <div>
                <strong>{getDisplayName(localItem.author?.displayName, 'Comunidade')}</strong>
                <p>{formatDate(localItem.createdAt)}</p>
              </div>
            </div>
          )}

          <button
            className="icon-button"
            type="button"
            aria-label="Mais opcoes"
            onClick={() => setShowMenu((current) => !current)}
          >
            <MoreIcon size={20} />
          </button>
        </div>

        {showMenu ? (
          <div className="post-menu">
            <button className="post-menu-button" type="button" onClick={handleExternalShare}>
              Compartilhar
            </button>
            <button className="post-menu-button" type="button" onClick={handleCopyLink}>
              Copiar link
            </button>
            {localItem.permissions?.canDelete ? (
              <button className="post-menu-button danger" type="button" onClick={handleDelete}>
                {deleting ? 'Removendo...' : 'Remover'}
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
          expandable
        />

        <div className="post-card-body">
          <div className="post-action-row instagram-action-row">
            <button
              className={localItem.isLiked ? 'icon-button active' : 'icon-button'}
              type="button"
              onClick={handleLike}
              disabled={!token || savingLike || !localItem.permissions?.canLike}
              aria-label={localItem.isLiked ? 'Descurtir' : 'Curtir'}
            >
              <HeartIcon size={21} filled={localItem.isLiked} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => commentInputRef.current?.focus()}
              aria-label="Comentar"
            >
              <CommentIcon size={21} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => setShowShareSheet(true)}
              aria-label="Enviar na DM"
            >
              <SendIcon size={21} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={handleExternalShare}
              aria-label="Compartilhar"
            >
              <ShareIcon size={21} />
            </button>
            {showPicoLink && localItem.pico ? (
              <Link className="post-inline-link" to={`/picos/${localItem.pico.slug}`}>
                Ver pico
              </Link>
            ) : null}
          </div>

          <div className="post-spot-row">
            {localItem.pico?.name ? <span className="status-pill">{localItem.pico.name}</span> : null}
            {localItem.distanceLabel ? <span className="status-pill">{localItem.distanceLabel}</span> : null}
          </div>

          <strong>{localItem.likesCount} curtidas</strong>
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
          <p className="post-caption-line">
            <strong>{localItem.author?.username || localItem.author?.displayName || 'picohunter'}</strong>{' '}
            {localItem.title}
          </p>
          {(localItem.commentsCount || localItem.comments?.length || 0) ? (
            <span className="post-meta-link">
              {localItem.commentsCount || localItem.comments?.length || 0} comentarios
            </span>
          ) : null}
        </div>

        {recentComments.length ? (
          <div className="comment-stack">
            {recentComments.map((comment) => (
              <div key={comment.id} className="comment-card">
                <strong>{getDisplayName(comment.author?.displayName, 'Comunidade')}</strong>
                <p>{comment.text}</p>
              </div>
            ))}
          </div>
        ) : null}

        {currentUser && localItem.permissions?.canComment ? (
          <form className="comment-form" onSubmit={handleCommentSubmit}>
            <input
              ref={commentInputRef}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Escreva um comentario..."
            />
            <button
              className="post-inline-link send-comment-button"
              type="submit"
              disabled={savingComment || !commentText.trim()}
            >
              {savingComment ? 'Enviando...' : 'Enviar'}
            </button>
          </form>
        ) : null}

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </article>

      <ShareSheet
        open={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        token={token}
        media={localItem}
        onShared={() => setMessage('Enviado na DM.')}
      />
    </>
  )
}
