import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api'
import MediaAsset from './MediaAsset'
import { getDisplayName, getInitial } from '../utils/text'

function makeTargetKey(type, id) {
  return `${type}:${id}`
}

export default function ShareSheet({ open, onClose, token, media, onShared }) {
  const [mutuals, setMutuals] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedTargets, setSelectedTargets] = useState([])
  const [note, setNote] = useState('')
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !token) return

    let cancelled = false

    async function loadTargets() {
      setLoading(true)
      setError('')

      try {
        const payload = await apiRequest('/api/dms', { token })
        if (cancelled) return
        setMutuals(payload.mutuals || [])
        setGroups(payload.groups || [])
      } catch (nextError) {
        if (!cancelled) setError(nextError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadTargets()
    return () => {
      cancelled = true
    }
  }, [open, token])

  useEffect(() => {
    if (!open) {
      setSelectedTargets([])
      setNote('')
      setSearchText('')
      setError('')
    }
  }, [open])

  const filteredMutuals = useMemo(() => {
    const normalized = searchText.trim().toLowerCase()
    if (!normalized) return mutuals

    return mutuals.filter((person) => {
      const displayName = person.displayName?.toLowerCase() || ''
      const username = person.username?.toLowerCase() || ''
      return displayName.includes(normalized) || username.includes(normalized)
    })
  }, [mutuals, searchText])

  const filteredGroups = useMemo(() => {
    const normalized = searchText.trim().toLowerCase()
    if (!normalized) return groups

    return groups.filter((item) => {
      const displayName = item.displayName?.toLowerCase() || ''
      return displayName.includes(normalized)
    })
  }, [groups, searchText])

  function toggleTarget(targetKey) {
    setSelectedTargets((current) =>
      current.includes(targetKey)
        ? current.filter((item) => item !== targetKey)
        : [...current, targetKey],
    )
  }

  async function handleSend() {
    if (!token || !media?.id || !selectedTargets.length || sending) return

    setSending(true)
    setError('')

    try {
      for (const targetKey of selectedTargets) {
        const [type, id] = targetKey.split(':')
        let conversationId = id

        if (type === 'user') {
          const payload = await apiRequest('/api/dms', {
            method: 'POST',
            token,
            body: { recipientUserId: id },
          })
          conversationId = payload.conversation.id
        }

        await apiRequest(`/api/dms/${conversationId}/messages`, {
          method: 'POST',
          token,
          body: {
            type: 'shared_media',
            mediaId: media.id,
            note,
          },
        })
      }

      onShared?.()
      onClose?.()
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="share-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <strong>Enviar</strong>
            <p>Amigos e grupos</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">
            x
          </button>
        </div>

        <div className="share-preview-card">
          <MediaAsset
            className="share-preview-thumb"
            src={media?.fileUrl}
            alt={media?.title}
            mediaType={media?.mediaType}
            controls={false}
          />
          <div>
            <strong>{media?.title || 'Post'}</strong>
            <p>{media?.pico?.name || 'PicoHunter'}</p>
          </div>
        </div>

        <input
          className="share-search-input"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Buscar amigos ou grupos"
        />

        {loading ? <p className="muted-text">Carregando contatos...</p> : null}

        {filteredMutuals.length ? (
          <div className="share-target-grid">
            {filteredMutuals.map((person) => {
              const targetKey = makeTargetKey('user', person.id)
              const active = selectedTargets.includes(targetKey)

              return (
                <button
                  key={person.id}
                  className={active ? 'share-target-card active' : 'share-target-card'}
                  type="button"
                  onClick={() => toggleTarget(targetKey)}
                >
                  <div className="share-target-avatar-shell">
                    {person.avatarUrl ? (
                      <MediaAsset className="share-target-avatar" src={person.avatarUrl} alt={getDisplayName(person.displayName)} />
                    ) : (
                      <div className="avatar-circle share-target-avatar">
                        {getInitial(person.displayName)}
                      </div>
                    )}
                    {active ? <span className="share-target-check">OK</span> : null}
                  </div>
                  <strong>{getDisplayName(person.displayName)}</strong>
                  <span>@{person.username || 'picohunter'}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {filteredGroups.length ? (
          <div className="share-group-list">
            {filteredGroups.map((item) => {
              const targetKey = makeTargetKey('conversation', item.id)
              const active = selectedTargets.includes(targetKey)

              return (
                <button
                  key={item.id}
                  className={active ? 'share-group-row active' : 'share-group-row'}
                  type="button"
                  onClick={() => toggleTarget(targetKey)}
                >
                  <div className="share-group-user">
                    {item.avatarUrl ? (
                      <MediaAsset className="share-group-avatar" src={item.avatarUrl} alt={getDisplayName(item.displayName, 'Grupo')} />
                    ) : (
                      <div className="avatar-circle share-group-avatar">
                        {getInitial(item.displayName, 'G')}
                      </div>
                    )}
                    <div>
                      <strong>{getDisplayName(item.displayName, 'Grupo')}</strong>
                      <p>Grupo</p>
                    </div>
                  </div>
                  <span className={active ? 'status-pill active-share-pill' : 'status-pill'}>
                    {active ? 'Selecionado' : 'Grupo'}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}

        <textarea
          rows="2"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Escreva uma mensagem opcional"
        />

        {error ? <p className="error-text">{error}</p> : null}

        <button
          className="primary-button full-width"
          type="button"
          disabled={!selectedTargets.length || sending}
          onClick={handleSend}
        >
          {sending ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
