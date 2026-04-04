import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import MediaAsset from './MediaAsset'
import RouteMapPreview from './RouteMapPreview'
import { BookmarkIcon, CommentIcon, HeartIcon, RouteIcon, SendIcon } from './AppIcons'
import { getDisplayName, getInitial } from '../utils/text'
import {
  addRouteComment,
  buildSharedRouteUrl,
  formatRouteDistance,
  formatRouteDuration,
  toggleRouteLike,
  toggleRouteSave,
} from '../utils/routes'

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function RouteFeedCard({ item, currentUser, onUpdated, distanceLabel = '' }) {
  const [localItem, setLocalItem] = useState(item)
  const [commentText, setCommentText] = useState('')
  const [saving, setSaving] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const commentInputRef = useRef(null)

  const shareUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return buildSharedRouteUrl(localItem, origin)
  }, [localItem])

  async function handleLike() {
    if (saving) return

    setSaving('like')
    setError('')

    try {
      const nextItem = toggleRouteLike(localItem.id)
      setLocalItem(nextItem)
      onUpdated?.(nextItem)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSaving('')
    }
  }

  async function handleSave() {
    if (saving) return

    setSaving('save')
    setError('')

    try {
      const nextItem = toggleRouteSave(localItem.id)
      setLocalItem(nextItem)
      onUpdated?.(nextItem)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSaving('')
    }
  }

  async function handleShare() {
    setError('')
    setMessage('')

    try {
      if (navigator.share) {
        await navigator.share({
          title: localItem.name,
          text: `Explora essa rota do PicoHunter`,
          url: shareUrl,
        })
      } else {
        await navigator.clipboard.writeText(shareUrl)
      }

      setMessage('Link da rota pronto para compartilhar.')
    } catch {
      setError('Nao foi possivel compartilhar a rota agora.')
    }
  }

  async function handleCommentSubmit(event) {
    event.preventDefault()
    if (!currentUser || !commentText.trim() || saving) return

    setSaving('comment')
    setError('')

    try {
      const nextItem = addRouteComment(localItem.id, commentText, currentUser)
      setLocalItem(nextItem)
      setCommentText('')
      onUpdated?.(nextItem)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSaving('')
    }
  }

  return (
    <>
      <article className="route-feed-card">
        <div className="route-feed-head">
          <div className="user-chip">
            {localItem.authorSnapshot?.avatarUrl ? (
              <MediaAsset
                className="avatar-circle avatar-mini"
                src={localItem.authorSnapshot.avatarUrl}
                alt={getDisplayName(localItem.authorSnapshot.displayName, 'Hunter')}
              />
            ) : (
              <div className="avatar-circle avatar-mini">
                {getInitial(localItem.authorSnapshot?.displayName, 'H')}
              </div>
            )}
            <div>
              <strong>{getDisplayName(localItem.authorSnapshot?.displayName, 'Hunter')}</strong>
              <p>
                @{localItem.authorSnapshot?.username || 'picohunter'} • {formatDate(localItem.createdAt)}
              </p>
            </div>
          </div>

          <span className="route-sport-pill" style={{ '--route-color': localItem.sportMeta?.color }}>
            <RouteIcon size={16} />
            {localItem.sportMeta?.name}
          </span>
        </div>

        <Link className="route-feed-cover-link" to={`/rotas/${localItem.id}`}>
          <RouteMapPreview
            className="route-feed-preview"
            points={localItem.points}
            color={localItem.sportMeta?.color}
          />
        </Link>

        <div className="route-feed-body">
          <div className="route-feed-title-row">
            <div>
              <p className="eyebrow">PicoHunter Route Drop</p>
              <h2>{localItem.name}</h2>
            </div>
            <span className="pill">{localItem.difficultyMeta?.name}</span>
          </div>

          <p className="route-feed-description">
            {localItem.description || 'Percurso salvo pela comunidade para explorar a cidade em movimento.'}
          </p>

          <div className="route-feed-stats">
            <span>{formatRouteDistance(localItem.distanceKm)}</span>
            <span>{formatRouteDuration(localItem.estimatedMinutes)}</span>
            {distanceLabel ? <span>{distanceLabel}</span> : null}
          </div>

          {localItem.media[0] ? (
            <MediaAsset
              className={localItem.media[0].mediaType === 'video' ? 'route-media-hero route-media-video' : 'route-media-hero'}
              src={localItem.media[0].fileUrl}
              alt={localItem.media[0].title}
              mediaType={localItem.media[0].mediaType}
              controls={localItem.media[0].mediaType === 'video'}
              expandable
            />
          ) : null}

          <div className="route-feed-actions">
            <button
              className={localItem.likedByCurrentUser ? 'icon-button active' : 'icon-button'}
              type="button"
              onClick={handleLike}
              disabled={saving === 'like'}
            >
              <HeartIcon size={20} filled={localItem.likedByCurrentUser} />
              <span>{localItem.likesCount}</span>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                setShowComments(true)
                window.setTimeout(() => commentInputRef.current?.focus(), 80)
              }}
            >
              <CommentIcon size={20} />
              <span>{localItem.commentsCount}</span>
            </button>
            <button
              className={localItem.savedByCurrentUser ? 'icon-button active' : 'icon-button'}
              type="button"
              onClick={handleSave}
              disabled={saving === 'save'}
            >
              <BookmarkIcon size={20} filled={localItem.savedByCurrentUser} />
              <span>{localItem.savedByCurrentUser ? 'Salva' : 'Salvar'}</span>
            </button>
            <button className="icon-button" type="button" onClick={handleShare}>
              <SendIcon size={20} />
              <span>Share</span>
            </button>
            <Link className="route-detail-link" to={`/rotas/${localItem.id}`}>
              Abrir rota
            </Link>
          </div>
        </div>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </article>

      {showComments ? (
        <div className="sheet-backdrop" onClick={() => setShowComments(false)}>
          <div className="comments-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <strong>Comentarios da rota</strong>
              <button className="icon-button" type="button" onClick={() => setShowComments(false)}>
                x
              </button>
            </div>

            <div className="comments-sheet-list">
              {localItem.comments.length ? (
                localItem.comments.map((comment) => (
                  <article key={comment.id} className="comment-card">
                    <strong>{getDisplayName(comment.author?.displayName, 'Hunter')}</strong>
                    <p>{comment.text}</p>
                  </article>
                ))
              ) : (
                <p className="muted-text">Essa rota ainda nao recebeu comentarios.</p>
              )}
            </div>

            {currentUser ? (
              <form className="comment-sheet-form" onSubmit={handleCommentSubmit}>
                <input
                  ref={commentInputRef}
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="Comenta o role, o flow ou a dificuldade..."
                />
                <button className="primary-button" type="submit" disabled={saving === 'comment' || !commentText.trim()}>
                  {saving === 'comment' ? 'Enviando...' : 'Enviar'}
                </button>
              </form>
            ) : (
              <p className="muted-text">Entre para comentar nessa rota.</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
