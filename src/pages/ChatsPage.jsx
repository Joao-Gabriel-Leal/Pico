import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import { HeartIcon, PlusIcon, SendIcon } from '../components/AppIcons'
import { getDisplayName, getInitial } from '../utils/text'

function formatTime(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getConversationPreview(conversation) {
  if (!conversation?.lastMessage) return 'Comece a conversa'

  if (conversation.lastMessage.messageType === 'shared_media') {
    return conversation.lastMessage.note || 'Compartilhou um post'
  }

  return conversation.lastMessage.text || 'Nova mensagem'
}

function getConversationName(conversation) {
  return getDisplayName(conversation?.displayName || conversation?.otherUser?.displayName, 'Conversa')
}

export default function ChatsPage() {
  const [searchParams] = useSearchParams()
  const preferredConversationId = searchParams.get('conversation') || ''
  const { user, token } = useAuth()
  const [mutuals, setMutuals] = useState([])
  const [groups, setGroups] = useState([])
  const [conversations, setConversations] = useState([])
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [messageText, setMessageText] = useState('')
  const [showGroupComposer, setShowGroupComposer] = useState(false)
  const [groupTitle, setGroupTitle] = useState('')
  const [groupParticipants, setGroupParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [error, setError] = useState('')

  async function loadInbox(nextConversationId = '', refreshThread = true) {
    if (!token) return

    setLoading(true)

    try {
      const payload = await apiRequest('/api/dms', { token })
      setMutuals(payload.mutuals || [])
      setGroups(payload.groups || [])
      setConversations(payload.conversations || [])

      const fallbackConversationId =
        nextConversationId ||
        selectedConversationId ||
        preferredConversationId ||
        payload.conversations?.[0]?.id ||
        ''

      setSelectedConversationId(fallbackConversationId)

      if (fallbackConversationId && refreshThread) {
        const detailPayload = await apiRequest(`/api/dms/${fallbackConversationId}`, { token })
        setSelectedConversation(detailPayload.conversation)
      } else if (!fallbackConversationId) {
        setSelectedConversation(null)
      }
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    loadInbox(preferredConversationId)
  }, [token, preferredConversationId])

  useEffect(() => {
    if (!token || !selectedConversationId) return undefined

    const interval = window.setInterval(async () => {
      if (document.hidden) return

      try {
        const [inboxPayload, detailPayload] = await Promise.all([
          apiRequest('/api/dms', { token }),
          apiRequest(`/api/dms/${selectedConversationId}`, { token }),
        ])

        setMutuals(inboxPayload.mutuals || [])
        setGroups(inboxPayload.groups || [])
        setConversations(inboxPayload.conversations || [])
        setSelectedConversation(detailPayload.conversation)
      } catch {}
    }, 10000)

    return () => window.clearInterval(interval)
  }, [selectedConversationId, token])

  const unreadTotal = useMemo(
    () => conversations.reduce((total, item) => total + Number(item.unreadCount || 0), 0),
    [conversations],
  )

  const filteredConversations = useMemo(() => {
    const normalized = searchText.trim().toLowerCase()
    if (!normalized) return conversations

    return conversations.filter((item) => {
      const name = getConversationName(item).toLowerCase()
      const preview = getConversationPreview(item).toLowerCase()
      return name.includes(normalized) || preview.includes(normalized)
    })
  }, [conversations, searchText])

  const filteredMutuals = useMemo(() => {
    const normalized = searchText.trim().toLowerCase()
    if (!normalized) return mutuals

    return mutuals.filter((person) => {
      const displayName = person.displayName?.toLowerCase() || ''
      const username = person.username?.toLowerCase() || ''
      return displayName.includes(normalized) || username.includes(normalized)
    })
  }, [mutuals, searchText])

  function toggleGroupParticipant(userId) {
    setGroupParticipants((current) =>
      current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId],
    )
  }

  async function handleSelectConversation(conversationId) {
    setSelectedConversationId(conversationId)
    setError('')

    try {
      const payload = await apiRequest(`/api/dms/${conversationId}`, { token })
      setSelectedConversation(payload.conversation)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleStartConversation(recipientUserId) {
    setError('')

    try {
      const payload = await apiRequest('/api/dms', {
        method: 'POST',
        token,
        body: { recipientUserId },
      })
      setSelectedConversationId(payload.conversation.id)
      setSelectedConversation(payload.conversation)
      await loadInbox(payload.conversation.id, false)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleCreateGroup() {
    if (!groupParticipants.length || creatingGroup) return

    setCreatingGroup(true)
    setError('')

    try {
      const payload = await apiRequest('/api/dms', {
        method: 'POST',
        token,
        body: {
          title: groupTitle,
          participantUserIds: groupParticipants,
        },
      })
      setShowGroupComposer(false)
      setGroupParticipants([])
      setGroupTitle('')
      setSelectedConversationId(payload.conversation.id)
      setSelectedConversation(payload.conversation)
      await loadInbox(payload.conversation.id, false)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setCreatingGroup(false)
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault()
    if (!messageText.trim() || !selectedConversationId) return

    setSending(true)
    setError('')

    try {
      const payload = await apiRequest(`/api/dms/${selectedConversationId}/messages`, {
        method: 'POST',
        token,
        body: {
          type: 'text',
          text: messageText,
        },
      })
      setSelectedConversation(payload.conversation)
      setMessageText('')
      await loadInbox(payload.conversation.id, false)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSending(false)
    }
  }

  async function handleToggleReaction(messageId) {
    if (!selectedConversationId) return

    try {
      const payload = await apiRequest(
        `/api/dms/${selectedConversationId}/messages/${messageId}/reactions`,
        {
          method: 'POST',
          token,
        },
      )
      setSelectedConversation(payload.conversation)
      await loadInbox(selectedConversationId, false)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  if (!user) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <h1>Entre para conversar</h1>
          <Link className="primary-button small-link-button" to="/entrar">
            Entrar agora
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="chat-page">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div>
            <h1>Mensagens</h1>
            <p>{unreadTotal} novas</p>
          </div>
          <button className="topbar-icon-button" type="button" onClick={() => setShowGroupComposer(true)}>
            <PlusIcon size={20} />
          </button>
        </div>

        <input
          className="chat-search-input"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Buscar"
        />

        <div className="chat-mutual-strip">
          {filteredMutuals.map((person) => (
            <button
              key={person.id}
              className="chat-mutual-card"
              type="button"
              onClick={() => handleStartConversation(person.id)}
            >
              {person.avatarUrl ? (
                <MediaAsset className="chat-mutual-avatar" src={person.avatarUrl} alt={getDisplayName(person.displayName)} />
              ) : (
                <div className="avatar-circle chat-mutual-avatar">
                  {getInitial(person.displayName)}
                </div>
              )}
              <span>{getDisplayName(person.displayName)}</span>
            </button>
          ))}
        </div>

        <div className="chat-inbox-list">
          {loading ? <p className="muted-text">Carregando conversas...</p> : null}
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              className={
                conversation.id === selectedConversationId
                  ? 'chat-inbox-row active'
                  : 'chat-inbox-row'
              }
              type="button"
              onClick={() => handleSelectConversation(conversation.id)}
            >
              {conversation.avatarUrl ? (
                <MediaAsset className="chat-row-avatar" src={conversation.avatarUrl} alt={conversation.displayName} />
              ) : conversation.otherUser?.avatarUrl ? (
                <MediaAsset className="chat-row-avatar" src={conversation.otherUser.avatarUrl} alt={conversation.displayName} />
              ) : (
                <div className="avatar-circle chat-row-avatar">
                  {getInitial(getConversationName(conversation), 'C')}
                </div>
              )}

              <div className="chat-row-copy">
                <strong>{getConversationName(conversation)}</strong>
                <p>{getConversationPreview(conversation)}</p>
              </div>

              <div className="chat-row-meta">
                {conversation.lastMessage?.createdAt ? (
                  <span>{formatTime(conversation.lastMessage.createdAt)}</span>
                ) : null}
                {conversation.unreadCount ? <span className="chat-unread-dot" /> : null}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <div className="chat-thread-shell">
        {selectedConversation ? (
          <>
            <div className="chat-thread-header">
              <div className="chat-thread-user">
                {selectedConversation.avatarUrl ? (
                  <MediaAsset className="chat-row-avatar" src={selectedConversation.avatarUrl} alt={selectedConversation.displayName} />
                ) : selectedConversation.otherUser?.avatarUrl ? (
                  <MediaAsset className="chat-row-avatar" src={selectedConversation.otherUser.avatarUrl} alt={selectedConversation.displayName} />
                ) : (
                  <div className="avatar-circle chat-row-avatar">
                    {getInitial(getConversationName(selectedConversation), 'C')}
                  </div>
                )}
                <div>
                  <strong>{getConversationName(selectedConversation)}</strong>
                  <p>
                    {selectedConversation.isGroup
                      ? `${selectedConversation.participants.length} pessoas`
                      : selectedConversation.otherUser?.username
                        ? `@${selectedConversation.otherUser.username}`
                        : 'DM'}
                  </p>
                </div>
              </div>
            </div>

            <div className="chat-messages-list">
              {selectedConversation.messages.map((item) => {
                const isOwn = item.senderId === user.id

                return (
                  <article
                    key={item.id}
                    className={isOwn ? 'chat-message-row own' : 'chat-message-row'}
                  >
                    {!isOwn ? (
                      item.sender?.avatarUrl ? (
                        <MediaAsset className="chat-message-avatar" src={item.sender.avatarUrl} alt={item.sender.displayName} />
                      ) : (
                        <div className="avatar-circle chat-message-avatar">
                          {getInitial(item.sender?.displayName, 'P')}
                        </div>
                      )
                    ) : null}

                    <div className={isOwn ? 'chat-message-bubble own' : 'chat-message-bubble'}>
                      {item.messageType === 'shared_media' && item.sharedMedia ? (
                        <Link className="shared-message-card" to={`/picos/${item.sharedMedia.pico.slug}`}>
                          {item.sharedMedia.mediaType === 'video' ? (
                            <video
                              className="shared-message-thumb"
                              src={item.sharedMedia.fileUrl}
                              muted
                              playsInline
                            />
                          ) : (
                            <img className="shared-message-thumb" src={item.sharedMedia.fileUrl} alt={item.sharedMedia.title} />
                          )}
                          <div className="shared-message-copy">
                            <strong>{item.sharedMedia.author?.username || getDisplayName(item.sharedMedia.author?.displayName, 'picomap')}</strong>
                            <span>{item.sharedMedia.title}</span>
                            <small>{item.sharedMedia.pico.name}</small>
                          </div>
                        </Link>
                      ) : null}

                      {item.note ? <p className="chat-message-note">{item.note}</p> : null}
                      {item.messageType === 'text' && item.text ? <p>{item.text}</p> : null}

                      <div className="chat-message-meta">
                        <span>{formatTime(item.createdAt)}</span>
                        <button
                          className={item.reactions?.hasHeart ? 'chat-reaction-button active' : 'chat-reaction-button'}
                          type="button"
                          onClick={() => handleToggleReaction(item.id)}
                        >
                          <HeartIcon size={16} filled={item.reactions?.hasHeart} />
                          {item.reactions?.heartCount ? <small>{item.reactions.heartCount}</small> : null}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <form className="chat-composer" onSubmit={handleSendMessage}>
              <input
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder="Mensagem..."
              />
              <button className="chat-send-button" type="submit" disabled={sending || !messageText.trim()}>
                <SendIcon size={20} />
              </button>
            </form>
          </>
        ) : (
          <div className="dark-empty-state">Escolha uma conversa ou crie um grupo.</div>
        )}

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      {showGroupComposer ? (
        <div className="sheet-backdrop" onClick={() => setShowGroupComposer(false)}>
          <div className="group-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <strong>Novo grupo</strong>
              <button className="icon-button" type="button" onClick={() => setShowGroupComposer(false)}>
                x
              </button>
            </div>

            <label>
              Nome do grupo
              <input
                value={groupTitle}
                onChange={(event) => setGroupTitle(event.target.value)}
                placeholder="Role da noite"
              />
            </label>

            <div className="group-sheet-list">
              {mutuals.map((person) => (
                <button
                  key={person.id}
                  className={groupParticipants.includes(person.id) ? 'group-person-row active' : 'group-person-row'}
                  type="button"
                  onClick={() => toggleGroupParticipant(person.id)}
                >
                  <div className="chat-thread-user">
                    {person.avatarUrl ? (
                      <MediaAsset className="chat-row-avatar" src={person.avatarUrl} alt={getDisplayName(person.displayName)} />
                    ) : (
                      <div className="avatar-circle chat-row-avatar">
                        {getInitial(person.displayName)}
                      </div>
                    )}
                    <div>
                      <strong>{getDisplayName(person.displayName)}</strong>
                      <p>@{person.username || 'picomap'}</p>
                    </div>
                  </div>
                  <span className={groupParticipants.includes(person.id) ? 'status-pill active-share-pill' : 'status-pill'}>
                    {groupParticipants.includes(person.id) ? 'Ok' : 'Selecionar'}
                  </span>
                </button>
              ))}
            </div>

            <button
              className="primary-button full-width"
              type="button"
              disabled={creatingGroup || groupParticipants.length < 2}
              onClick={handleCreateGroup}
            >
              {creatingGroup ? 'Criando...' : 'Criar grupo'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
