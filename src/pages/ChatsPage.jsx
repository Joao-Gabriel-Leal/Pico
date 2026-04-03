import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'

function formatTime(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function ChatsPage() {
  const { user, token } = useAuth()
  const [following, setFollowing] = useState([])
  const [conversations, setConversations] = useState([])
  const [searchText, setSearchText] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messageText, setMessageText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  async function loadInbox(preferredConversationId = '', refreshThread = true) {
    if (!user) return

    setLoading(true)

    try {
      const payload = await apiRequest('/api/dms', { token })
      setFollowing(payload.following)
      setConversations(payload.conversations)

      const nextConversationId =
        preferredConversationId ||
        selectedConversationId ||
        payload.conversations[0]?.id ||
        ''

      setSelectedConversationId(nextConversationId)

      if (nextConversationId && refreshThread) {
        const detailPayload = await apiRequest(`/api/dms/${nextConversationId}`, { token })
        setSelectedConversation(detailPayload.conversation)
      } else if (!nextConversationId) {
        setSelectedConversation(null)
      }
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadInbox()
  }, [token, user])

  useEffect(() => {
    if (!user || !selectedConversationId) return undefined

    const interval = window.setInterval(async () => {
      try {
        const [inboxPayload, detailPayload] = await Promise.all([
          apiRequest('/api/dms', { token }),
          apiRequest(`/api/dms/${selectedConversationId}`, { token }),
        ])

        setFollowing(inboxPayload.following)
        setConversations(inboxPayload.conversations)
        setSelectedConversation(detailPayload.conversation)
      } catch {}
    }, 4000)

    return () => window.clearInterval(interval)
  }, [selectedConversationId, token, user])

  const unreadTotal = useMemo(
    () => conversations.reduce((total, conversation) => total + Number(conversation.unreadCount || 0), 0),
    [conversations],
  )

  const filteredConversations = useMemo(() => {
    const normalized = searchText.trim().toLowerCase()
    if (!normalized) return conversations

    return conversations.filter((conversation) => {
      const name = conversation.otherUser?.displayName?.toLowerCase() || ''
      const username = conversation.otherUser?.username?.toLowerCase() || ''
      const text = conversation.lastMessage?.text?.toLowerCase() || ''
      return name.includes(normalized) || username.includes(normalized) || text.includes(normalized)
    })
  }, [conversations, searchText])

  const filteredFollowing = useMemo(() => {
    const normalized = searchText.trim().toLowerCase()
    if (!normalized) return following

    return following.filter((person) => {
      const name = person.displayName?.toLowerCase() || ''
      const username = person.username?.toLowerCase() || ''
      return name.includes(normalized) || username.includes(normalized)
    })
  }, [following, searchText])

  async function handleSelectConversation(conversationId) {
    setSelectedConversationId(conversationId)
    setError('')

    try {
      const payload = await apiRequest(`/api/dms/${conversationId}`, { token })
      setSelectedConversation(payload.conversation)
      await apiRequest(`/api/dms/${conversationId}/read`, {
        method: 'POST',
        token,
      })
      await loadInbox(conversationId, false)
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
        body: {
          recipientUserId,
        },
      })

      setSelectedConversationId(payload.conversation.id)
      setSelectedConversation(payload.conversation)
      await loadInbox(payload.conversation.id, false)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault()
    setSending(true)
    setError('')

    try {
      const payload = await apiRequest(`/api/dms/${selectedConversationId}/messages`, {
        method: 'POST',
        token,
        body: {
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

  if (!user) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <h1>Entre para conversar</h1>
          <p className="muted-text">
            A DM agora usa inbox, conversa individual, bolhas de mensagem e contador de mensagens nao lidas.
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
      <div className="page-column page-column-main">
        <div className="dm-layout">
          <aside className="side-card dm-sidebar">
            <div className="section-title">
              <div>
                <p className="eyebrow">Inbox</p>
                <h1>Mensagens</h1>
              </div>
              <span className="status-pill">{unreadTotal} nao lidas</span>
            </div>

            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Pesquisar conversas ou pessoas"
            />

            <div className="story-row">
              {following.slice(0, 8).map((person) => (
                <button key={person.id} className="story-card" onClick={() => handleStartConversation(person.id)}>
                  {person.avatarUrl ? (
                    <MediaAsset className="avatar-circle avatar-mini" src={person.avatarUrl} alt={person.displayName} />
                  ) : (
                    <div className="avatar-circle avatar-mini">{person.displayName.slice(0, 1).toUpperCase()}</div>
                  )}
                  <span>{person.displayName}</span>
                </button>
              ))}
            </div>

            {loading ? <p className="muted-text">Carregando conversas...</p> : null}

            <div className="list-stack compact-list">
              {filteredConversations.length ? (
                filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    className={
                      conversation.id === selectedConversationId ? 'list-item active dm-list-item' : 'list-item dm-list-item'
                    }
                    onClick={() => handleSelectConversation(conversation.id)}
                  >
                    <div className="user-chip">
                      {conversation.otherUser?.avatarUrl ? (
                        <MediaAsset className="avatar-circle avatar-mini" src={conversation.otherUser.avatarUrl} alt={conversation.otherUser.displayName} />
                      ) : (
                        <div className="avatar-circle avatar-mini">
                          {conversation.otherUser?.displayName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <strong>{conversation.otherUser?.displayName || 'Conversa'}</strong>
                        <p>{conversation.lastMessage?.text || 'Sem mensagens ainda.'}</p>
                      </div>
                    </div>

                    <div className="dm-list-meta">
                      <span>{conversation.lastMessage ? formatTime(conversation.lastMessage.createdAt) : ''}</span>
                      {conversation.unreadCount ? <span className="pill">{conversation.unreadCount}</span> : null}
                    </div>
                  </button>
                ))
              ) : (
                <p className="muted-text">Nenhuma conversa ainda.</p>
              )}
            </div>

            <div className="section-divider" />

            <div className="section-title">
                <h2>Seguindo</h2>
                <span>{filteredFollowing.length}</span>
              </div>

            <div className="list-stack compact-list">
              {filteredFollowing.length ? (
                filteredFollowing.map((person) => (
                  <button
                    key={person.id}
                    className="list-item"
                    onClick={() => handleStartConversation(person.id)}
                  >
                    <div className="user-chip">
                      {person.avatarUrl ? (
                        <MediaAsset className="avatar-circle avatar-mini" src={person.avatarUrl} alt={person.displayName} />
                      ) : (
                        <div className="avatar-circle avatar-mini">{person.displayName.slice(0, 1).toUpperCase()}</div>
                      )}
                      <div>
                        <strong>{person.displayName}</strong>
                        <p>@{person.username}</p>
                      </div>
                    </div>
                    <span>Mensagem</span>
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <p className="muted-text">
                    Procure pessoas na aba de pesquisa para seguir e liberar conversas privadas aqui.
                  </p>
                  <Link className="secondary-button small-link-button full-width" to="/pesquisa">
                    Ir para pesquisa
                  </Link>
                </div>
              )}
            </div>
          </aside>

          <div className="side-card dm-thread">
            {selectedConversation ? (
              <>
                <div className="post-card-header">
                  <div className="user-chip">
                    {selectedConversation.otherUser?.avatarUrl ? (
                      <MediaAsset className="avatar-circle avatar-mini" src={selectedConversation.otherUser.avatarUrl} alt={selectedConversation.otherUser.displayName} />
                    ) : (
                      <div className="avatar-circle avatar-mini">
                        {selectedConversation.otherUser?.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <strong>{selectedConversation.otherUser?.displayName}</strong>
                      <p>@{selectedConversation.otherUser?.username}</p>
                    </div>
                  </div>
                  <span className="status-pill">{selectedConversation.messagesCount} mensagens</span>
                </div>

                <div className="dm-messages">
                  {selectedConversation.messages.map((item) => {
                    const isOwn = item.sender?.id === user.id

                    return (
                      <article
                        key={item.id}
                        className={isOwn ? 'message-bubble own-message' : 'message-bubble'}
                      >
                        <strong>{isOwn ? 'Voce' : item.sender?.displayName}</strong>
                        <p>{item.text}</p>
                        <span>{formatTime(item.createdAt)}</span>
                      </article>
                    )
                  })}
                </div>

                <form className="dm-composer" onSubmit={handleSendMessage}>
                  <textarea
                    rows="2"
                    placeholder="Escreva uma mensagem..."
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                  />
                  <button
                    className="primary-button"
                    disabled={sending || !selectedConversationId || !messageText.trim()}
                  >
                    {sending ? 'Enviando...' : 'Enviar'}
                  </button>
                </form>
              </>
            ) : (
              <div className="empty-state">
                <p className="muted-text">
                  Escolha uma conversa ou toque em um perfil que voce segue para abrir a DM.
                </p>
              </div>
            )}

            {error ? <p className="error-text">{error}</p> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
