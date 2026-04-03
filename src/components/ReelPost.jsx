import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api'
import MediaAsset from './MediaAsset'
import ShareSheet from './ShareSheet'
import { CommentIcon, HeartIcon, MoreIcon, SendIcon } from './AppIcons'

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function ReelPost({ item, token, currentUser, onUpdated, onDeleted }) {
  const [localItem, setLocalItem] = useState(item)
  const [commentText, setCommentText] = useState('')
  const [savingLike, setSavingLike] = useState(false)
  const [savingComment, setSavingComment] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const commentInputRef = useRef(null)

  useEffect(() => {
    setLocalItem(item)
  }, [item])

  const shareUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return localItem.pico?.slug ? `${base}/picos/${localItem.pico.slug}#midia-${localItem.id}` : base
  }, [localItem.id, localItem.pico?.slug])

  async function handleLike() {
    if (!token || savingLike || !localItem.permissions?.canLike) return

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
        body: { text: commentText },
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

  async function handleExternalShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: localItem.title,
          text: localItem.pico?.name || 'PicoMap',
          url: shareUrl,
        })
        setMessage('Compartilhado.')
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setMessage('Link copiado.')
      }
      setShowMenu(false)
    } catch {
      setError('Nao foi possivel compartilhar agora.')
    }
  }

  return (
    <>
      <article className="reel-card" id={`midia-${localItem.id}`}>
        <div className="reel-media-shell">
          <MediaAsset
            className="reels-media-asset"
            src={localItem.fileUrl}
            alt={localItem.title}
            mediaType={localItem.mediaType}
            autoPlayInView={localItem.mediaType === 'video'}
            controls={localItem.mediaType !== 'video'}
            expandable
          />

          <div className="reel-gradient" />

          <div className="reel-side-actions">
            <button
              className={localItem.isLiked ? 'reel-icon-button active' : 'reel-icon-button'}
              type="button"
              onClick={handleLike}
              disabled={!token || savingLike}
              aria-label="Curtir"
            >
              <HeartIcon size={24} filled={localItem.isLiked} />
              <span>{localItem.likesCount}</span>
            </button>

            <button
              className="reel-icon-button"
              type="button"
              onClick={() => {
                setShowComments(true)
                window.setTimeout(() => commentInputRef.current?.focus(), 80)
              }}
              aria-label="Comentar"
            >
              <CommentIcon size={24} />
              <span>{localItem.commentsCount}</span>
            </button>

            <button
              className="reel-icon-button"
              type="button"
              onClick={() => setShowShareSheet(true)}
              aria-label="Enviar"
            >
              <SendIcon size={24} />
              <span>Enviar</span>
            </button>

            <button
              className="reel-icon-button"
              type="button"
              onClick={() => setShowMenu((current) => !current)}
              aria-label="Mais opcoes"
            >
              <MoreIcon size={24} />
            </button>
          </div>

          <div className="reel-overlay-copy">
            <div className="reel-author-row">
              {localItem.author?.avatarUrl ? (
                <MediaAsset className="avatar-circle avatar-mini" src={localItem.author.avatarUrl} alt={localItem.author.displayName} />
              ) : (
                <div className="avatar-circle avatar-mini">
                  {(localItem.author?.displayName || 'P').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <strong>{localItem.author?.username || localItem.author?.displayName}</strong>
                <p>
                  {localItem.pico?.name} - {formatDate(localItem.createdAt)}
                </p>
              </div>
            </div>

            <p className="reel-caption">{localItem.title}</p>
            {localItem.pico ? (
              <Link className="reel-pico-link" to={`/picos/${localItem.pico.slug}`}>
                Ver pico
              </Link>
            ) : null}
          </div>

          {showMenu ? (
            <div className="reel-menu">
              <button className="post-menu-button" type="button" onClick={handleExternalShare}>
                Compartilhar
              </button>
              <button
                className="post-menu-button"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl)
                    setMessage('Link copiado.')
                    setShowMenu(false)
                  } catch {
                    setError('Nao foi possivel copiar o link.')
                  }
                }}
              >
                Copiar link
              </button>
              {localItem.permissions?.canDelete ? (
                <button className="post-menu-button danger" type="button" onClick={handleDelete}>
                  {deleting ? 'Removendo...' : 'Remover'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </article>

      {showComments ? (
        <div className="sheet-backdrop" onClick={() => setShowComments(false)}>
          <div className="comments-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <strong>Comentarios</strong>
              <button className="icon-button" type="button" onClick={() => setShowComments(false)}>
                x
              </button>
            </div>

            <div className="comments-sheet-list">
              {localItem.comments?.length ? (
                localItem.comments.map((comment) => (
                  <article key={comment.id} className="comment-card">
                    <strong>{comment.author?.displayName || 'Comunidade'}</strong>
                    <p>{comment.text}</p>
                  </article>
                ))
              ) : (
                <p className="muted-text">Seja a primeira pessoa a comentar.</p>
              )}
            </div>

            {currentUser && localItem.permissions?.canComment ? (
              <form className="comment-sheet-form" onSubmit={handleCommentSubmit}>
                <input
                  ref={commentInputRef}
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="Escreva um comentario..."
                />
                <button className="primary-button" type="submit" disabled={savingComment || !commentText.trim()}>
                  {savingComment ? 'Enviando...' : 'Enviar'}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

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
