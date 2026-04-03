import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import MediaAsset from '../components/MediaAsset'
import SocialPostCard from '../components/SocialPostCard'
import { uploadSelectedFile } from '../utils/files'
import { getDisplayName, getInitial } from '../utils/text'

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default function PicoPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const [detail, setDetail] = useState(null)
  const [sports, setSports] = useState([])
  const [people, setPeople] = useState([])
  const [editing, setEditing] = useState(false)
  const [showPostComposer, setShowPostComposer] = useState(false)
  const [showEventComposer, setShowEventComposer] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [adminUserId, setAdminUserId] = useState('')
  const [contributionAmount, setContributionAmount] = useState('20')
  const [campaignForm, setCampaignForm] = useState({ title: '', purpose: '', goalCents: 500000 })
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    sportId: '',
    startsAt: '',
    entryFeeCents: 0,
    prizePoolCents: 0,
  })
  const [mediaForm, setMediaForm] = useState({ mediaType: 'photo', title: '', fileUrl: '' })
  const [editForm, setEditForm] = useState({
    name: '',
    primarySportId: '',
    description: '',
    statusText: '',
    conditionLabel: '',
    coverImageUrl: '',
  })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const postComposerRef = useRef(null)
  const eventComposerRef = useRef(null)

  async function loadPage() {
    const requests = [apiRequest(`/api/picos/${slug}`, { token }), apiRequest('/api/auth/options')]
    if (token) requests.push(apiRequest('/api/people', { token }))

    const [picoPayload, referencePayload, peoplePayload] = await Promise.all(requests)
    const item = picoPayload.item
    setDetail(item)
    setSports(referencePayload.sports)
    setPeople(peoplePayload?.items || [])
    setAdminUserId(peoplePayload?.items?.[0]?.id || '')
    setEventForm((current) => ({ ...current, sportId: current.sportId || item.sport.id }))
    setEditForm({
      name: item.name,
      primarySportId: item.sport.id,
      description: item.description,
      statusText: item.statusText,
      conditionLabel: item.conditionLabel,
      coverImageUrl: item.coverImageUrl || '',
    })
  }

  useEffect(() => {
    loadPage().catch((nextError) => setError(nextError.message))
  }, [slug, token])

  useEffect(() => {
    if (showPostComposer && postComposerRef.current) postComposerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showPostComposer])

  useEffect(() => {
    if (showEventComposer && eventComposerRef.current) eventComposerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showEventComposer])

  async function refreshDetail() {
    const payload = await apiRequest(`/api/picos/${slug}`, { token })
    setDetail(payload.item)
    return payload.item
  }

  async function handleVote() {
    setMessage('')
    setError('')
    try {
      await apiRequest(`/api/picos/${slug}/vote`, { method: 'POST', token })
      await refreshDetail()
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleTogglePicoFollow() {
    setMessage('')
    setError('')
    try {
      await apiRequest(`/api/picos/${slug}/follow`, { method: 'POST', token })
      await refreshDetail()
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleTogglePicoVisit() {
    setMessage('')
    setError('')
    try {
      await apiRequest(`/api/picos/${slug}/visit`, { method: 'POST', token })
      await refreshDetail()
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleContribution(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    try {
      await apiRequest(`/api/picos/${slug}/contributions`, {
        method: 'POST',
        token,
        body: { amountCents: Number(contributionAmount) * 100 },
      })
      await refreshDetail()
      setMessage('Contribuicao registrada.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleCampaignSubmit(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    try {
      await apiRequest(`/api/picos/${slug}/campaigns`, { method: 'POST', token, body: campaignForm })
      await refreshDetail()
      setCampaignForm({ title: '', purpose: '', goalCents: 500000 })
      setMessage('Vaquinha aberta com sucesso.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleEventSubmit(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    try {
      const payload = await apiRequest(`/api/picos/${slug}/events`, { method: 'POST', token, body: eventForm })
      await refreshDetail()
      setEventForm((current) => ({ ...current, title: '', description: '', startsAt: '', entryFeeCents: 0, prizePoolCents: 0 }))
      setShowEventComposer(false)
      setMessage(payload.item?.approvalStatus === 'approved' ? 'Evento publicado no perfil do pico.' : 'Evento enviado para aprovacao do time do pico.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleMediaFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingMedia(true)
    setError('')
    try {
      const uploadedUrl = await uploadSelectedFile(file, { token, kind: mediaForm.mediaType === 'video' ? 'video' : 'image' })
      setMediaForm((current) => ({ ...current, fileUrl: uploadedUrl, title: current.title || file.name.replace(/\.[^.]+$/, '') }))
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setUploadingMedia(false)
      event.target.value = ''
    }
  }

  async function handleMediaSubmit(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    try {
      await apiRequest(`/api/picos/${slug}/media`, { method: 'POST', token, body: { ...mediaForm, scope: 'feed' } })
      await refreshDetail()
      setMediaForm({ mediaType: 'photo', title: '', fileUrl: '' })
      setShowPostComposer(false)
      setMessage('Post publicado no pico.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleEditSubmit(event) {
    event.preventDefault()
    setSavingEdit(true)
    setMessage('')
    setError('')
    try {
      const payload = await apiRequest(`/api/picos/${slug}`, {
        method: 'PUT',
        token,
        body: { ...editForm, latitude: detail.latitude, longitude: detail.longitude },
      })
      setDetail(payload.item)
      setEditing(false)
      setMessage('Pico atualizado com sucesso.')
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeletePico() {
    setError('')
    setMessage('')
    try {
      await apiRequest(`/api/picos/${slug}`, { method: 'DELETE', token })
      navigate('/mapa')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleApprovePico() {
    try {
      const payload = await apiRequest(`/api/moderation/picos/${slug}/approve`, { method: 'POST', token })
      setDetail(payload.item)
      setMessage('Pico aprovado com sucesso.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleRejectPico() {
    try {
      const payload = await apiRequest(`/api/moderation/picos/${slug}/reject`, { method: 'POST', token })
      setDetail(payload.item)
      setMessage('Pico rejeitado.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleAddAdmin(event) {
    event.preventDefault()
    if (!adminUserId) return
    try {
      const payload = await apiRequest(`/api/picos/${slug}/admins`, { method: 'POST', token, body: { userId: adminUserId } })
      setDetail(payload.item)
      setMessage('Administrador adicionado ao pico.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleRemoveAdmin(targetUserId) {
    try {
      const payload = await apiRequest(`/api/picos/${slug}/admins/${targetUserId}`, { method: 'DELETE', token })
      setDetail(payload.item)
      setMessage('Administrador removido do pico.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  function handleMediaUpdated(updatedItem) {
    setDetail((current) => current ? ({
      ...current,
      media: current.media.map((item) => (item.id === updatedItem.id ? { ...item, ...updatedItem } : item)),
      feedPosts: current.feedPosts.map((item) => (item.id === updatedItem.id ? { ...item, ...updatedItem } : item)),
      topVideos: current.topVideos.map((item) => (item.id === updatedItem.id ? { ...item, ...updatedItem } : item)),
    }) : current)
  }

  function handleMediaDeleted(mediaId) {
    setDetail((current) => current ? ({
      ...current,
      media: current.media.filter((item) => item.id !== mediaId),
      feedPosts: current.feedPosts.filter((item) => item.id !== mediaId),
      topVideos: current.topVideos.filter((item) => item.id !== mediaId),
    }) : current)
  }

  const activeCampaign = useMemo(() => detail?.campaigns?.find((item) => item.status === 'active') || null, [detail])

  if (error && !detail) {
    return <section className="simple-page"><div className="side-card"><h1>Pico nao encontrado</h1><p className="error-text">{error}</p><Link className="primary-button small-link-button" to="/mapa">Voltar</Link></div></section>
  }

  if (!detail) {
    return <section className="simple-page"><div className="side-card"><p className="muted-text">Carregando perfil do pico...</p></div></section>
  }

  return (
    <section className="page-grid social-page">
      <div className="page-column page-column-main feed-column">
        <div className="hero-card pico-hero">
          <div className="pico-hero-grid">
            <div>
              <p className="eyebrow">Perfil do pico</p>
              <h1>{detail.name}</h1>
              <p className="hero-copy">{detail.sport.name} - {detail.description}</p>
              <p className="muted-text">A galeria abaixo mostra o pico. O feed recebe so os posts da comunidade.</p>
              <div className="hero-actions wrap-actions">
                <span className="status-pill">{detail.conditionLabel}</span>
                <span className="status-pill">{detail.voteCount} curtidas</span>
                {detail.permissions?.isPicoAdmin ? <span className="pill">Administrador do pico</span> : null}
                {detail.approvalStatus !== 'approved' ? <span className="pill">Aguardando aprovacao</span> : null}
                {user ? <button className="secondary-button" type="button" onClick={handleVote}>{detail.hasVoted ? 'Tirar curtida' : 'Curtir pico'}</button> : <Link className="secondary-button small-link-button" to="/entrar">Entrar para votar</Link>}
                {user ? <button className={detail.isFollowing ? 'secondary-button' : 'ghost-button'} type="button" onClick={handleTogglePicoFollow}>{detail.isFollowing ? 'Seguindo pico' : 'Seguir pico'}</button> : null}
                {user ? <button className={detail.isVisited ? 'secondary-button' : 'ghost-button'} type="button" onClick={handleTogglePicoVisit}>{detail.isVisited ? 'Ja andei aqui' : 'Marcar que ja andei'}</button> : null}
                {detail.permissions?.canPost ? <button className="primary-button small-link-button" type="button" onClick={() => { setShowPostComposer((current) => !current); setShowEventComposer(false) }}>{showPostComposer ? 'Fechar post' : 'Nova publicacao'}</button> : null}
                {(detail.permissions?.canManageEvents || user?.permissions?.includes('event.submit')) ? <button className="secondary-button small-link-button" type="button" onClick={() => { setShowEventComposer((current) => !current); setShowPostComposer(false) }}>{showEventComposer ? 'Fechar evento' : detail.permissions?.canManageEvents ? 'Novo evento' : 'Sugerir evento'}</button> : null}
              </div>
            </div>
            <MediaAsset className="hero-image" src={detail.coverImageUrl || detail.previewPhoto} alt={detail.name} expandable />
          </div>
        </div>

        {detail.approvalStatus !== 'approved' ? (
          <div className="side-card moderation-banner">
            <div className="section-title"><h2>Status do pico</h2><span>{detail.approvalStatus}</span></div>
            <p className="muted-text">{detail.permissions?.canApprovePico ? 'Esse pico esta aguardando sua moderacao.' : 'Esse pico ainda esta aguardando aprovacao da administracao.'}</p>
            {detail.permissions?.canApprovePico ? <div className="inline-actions wrap-actions"><button className="primary-button small-link-button" type="button" onClick={handleApprovePico}>Aprovar pico</button><button className="ghost-button small-button" type="button" onClick={handleRejectPico}>Rejeitar pico</button></div> : null}
          </div>
        ) : null}

        {showPostComposer ? (
          <div className="side-card compose-card" ref={postComposerRef}>
            <div className="section-title"><h2>Nova publicacao</h2><span>feed do pico</span></div>
            <form className="form-card compact-form" onSubmit={handleMediaSubmit}>
              <label>Tipo<select value={mediaForm.mediaType} onChange={(event) => setMediaForm((current) => ({ ...current, mediaType: event.target.value, fileUrl: '' }))}><option value="photo">Foto</option><option value="video">Video</option></select></label>
              <label>Titulo<input value={mediaForm.title} onChange={(event) => setMediaForm((current) => ({ ...current, title: event.target.value }))} /></label>
              <label>Arquivo<input type="file" accept={mediaForm.mediaType === 'video' ? 'video/*' : 'image/*'} onChange={handleMediaFileChange} /></label>
              <button className="primary-button full-width" disabled={uploadingMedia || !mediaForm.fileUrl}>{uploadingMedia ? 'Enviando...' : 'Publicar no pico'}</button>
            </form>
          </div>
        ) : null}

        {showEventComposer ? (
          <div className="side-card compose-card" ref={eventComposerRef}>
            <div className="section-title"><h2>{detail.permissions?.canManageEvents ? 'Novo evento' : 'Sugerir evento'}</h2><span>agenda do pico</span></div>
            <form className="form-card compact-form" onSubmit={handleEventSubmit}>
              <label>Titulo<input value={eventForm.title} onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))} /></label>
              <label>Esporte<select value={eventForm.sportId} onChange={(event) => setEventForm((current) => ({ ...current, sportId: Number(event.target.value) }))}><option value="">Selecione</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
              <label>Data e hora<input type="datetime-local" value={eventForm.startsAt} onChange={(event) => setEventForm((current) => ({ ...current, startsAt: event.target.value }))} /></label>
              <div className="two-column-grid">
                <label>Entrada<input value={eventForm.entryFeeCents} onChange={(event) => setEventForm((current) => ({ ...current, entryFeeCents: Number(event.target.value) }))} /></label>
                <label>Premio<input value={eventForm.prizePoolCents} onChange={(event) => setEventForm((current) => ({ ...current, prizePoolCents: Number(event.target.value) }))} /></label>
              </div>
              <label>Descricao<textarea rows="3" value={eventForm.description} onChange={(event) => setEventForm((current) => ({ ...current, description: event.target.value }))} /></label>
              <button className="primary-button full-width">{detail.permissions?.canManageEvents ? 'Publicar evento' : 'Enviar para aprovacao'}</button>
            </form>
          </div>
        ) : null}

        <div className="two-card-grid">
          <div className="side-card"><div className="section-title"><h2>Resumo</h2><span>{detail.statusText}</span></div><div className="stats-stack"><article><span>Galeria</span><strong>{detail.galleryMedia.length}</strong></article><article><span>Posts</span><strong>{detail.feedPosts.length}</strong></article><article><span>Eventos</span><strong>{detail.events.length}</strong></article><article><span>Seguidores</span><strong>{detail.followerCount}</strong></article><article><span>Ja andaram</span><strong>{detail.visitCount}</strong></article></div></div>
          <div className="side-card"><div className="section-title"><h2>Quem curtiu</h2><span>{detail.likedBy.length}</span></div><div className="list-stack compact-list">{detail.likedBy.length ? detail.likedBy.map((person) => <div key={person.id} className="list-item static-item"><div className="user-chip">{person.avatarUrl ? <MediaAsset className="avatar-circle avatar-mini" src={person.avatarUrl} alt={getDisplayName(person.displayName)} /> : <div className="avatar-circle avatar-mini">{getInitial(person.displayName)}</div>}<div><strong>{getDisplayName(person.displayName)}</strong><p>@{person.username || 'picomap'}</p></div></div></div>) : <p className="muted-text">Ainda nao ha curtidas registradas nesse pico.</p>}</div></div>
        </div>

        <div className="section-title"><h2>Galeria do pico</h2><span>{detail.galleryMedia.length}</span></div>
        {detail.galleryMedia.length ? <div className="photo-grid">{detail.galleryMedia.map((item) => <MediaAsset key={item.id} className={item.mediaType === 'video' ? 'gallery-video' : 'gallery-image'} src={item.fileUrl} alt={item.title} mediaType={item.mediaType} controls={item.mediaType === 'video'} expandable />)}</div> : <div className="side-card empty-state"><p className="muted-text">Esse pico ainda nao tem fotos de apresentacao cadastradas.</p></div>}

        <div className="two-card-grid">
          <div className="side-card"><div className="section-title"><h2>Administradores</h2><span>{detail.admins.length}</span></div><div className="list-stack compact-list">{detail.admins.map((person) => <div key={person.id} className="list-item static-item"><div className="user-chip">{person.avatarUrl ? <MediaAsset className="avatar-circle avatar-mini" src={person.avatarUrl} alt={getDisplayName(person.displayName)} /> : <div className="avatar-circle avatar-mini">{getInitial(person.displayName)}</div>}<div><strong>{getDisplayName(person.displayName)}</strong><p>@{person.username || 'picomap'}</p></div></div>{detail.permissions?.canManageAdmins ? <button className="ghost-button small-button" type="button" onClick={() => handleRemoveAdmin(person.id)}>Remover</button> : null}</div>)}</div></div>
          <div className="side-card"><div className="section-title"><h2>Top 5 videos</h2><span>semana</span></div><div className="list-stack compact-list">{detail.topVideos.length ? detail.topVideos.map((item, index) => <div key={item.id} className="list-item static-item"><div><strong>{index + 1}. {item.title}</strong><p>{item.viewsCount} views</p></div><span>{item.likesCount} curtidas</span></div>) : <p className="muted-text">Ainda nao ha videos ranqueados.</p>}</div></div>
        </div>

        {detail.permissions?.canEdit ? (
          <div className="side-card">
            <div className="section-title"><h2>Gestao do pico</h2><span>permissoes ativas</span></div>
            <div className="inline-actions wrap-actions">
              <button className="secondary-button" type="button" onClick={() => setEditing((current) => !current)}>{editing ? 'Fechar edicao' : 'Editar pico'}</button>
              {detail.permissions?.canDelete ? <button className="ghost-button" type="button" onClick={handleDeletePico}>Remover pico</button> : null}
            </div>
            {editing ? (
              <form className="form-card compact-form" onSubmit={handleEditSubmit}>
                <label>Nome<input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Esporte principal<select value={editForm.primarySportId} onChange={(event) => setEditForm((current) => ({ ...current, primarySportId: Number(event.target.value) }))}><option value="">Selecione</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
                <label>Descricao<textarea rows="3" value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} /></label>
                <div className="two-column-grid"><label>Status atual<input value={editForm.statusText} onChange={(event) => setEditForm((current) => ({ ...current, statusText: event.target.value }))} /></label><label>Selo rapido<input value={editForm.conditionLabel} onChange={(event) => setEditForm((current) => ({ ...current, conditionLabel: event.target.value }))} /></label></div>
                <label>Foto de capa<input value={editForm.coverImageUrl} onChange={(event) => setEditForm((current) => ({ ...current, coverImageUrl: event.target.value }))} /></label>
                <button className="primary-button full-width" disabled={savingEdit}>{savingEdit ? 'Salvando...' : 'Salvar alteracoes'}</button>
              </form>
            ) : null}
          </div>
        ) : null}

        <div className="section-title"><h2>Eventos do pico</h2><span>{detail.events.length}</span></div>
        <div className="list-stack">{detail.events.length ? detail.events.map((item) => <article key={item.id} className="post-card"><div className="post-card-header"><div><p className="eyebrow">Evento do pico</p><h2>{item.title}</h2></div><span className="pill">{item.sport?.name}</span></div><div className="post-card-body"><p>{item.description || 'Evento criado pela comunidade do pico.'}</p><div className="meta-row wrap-actions"><span>{formatDate(item.startsAt)}</span><span>{item.entryFeeLabel} entrada</span><span>{item.prizePoolLabel} premio</span>{item.approvalStatus !== 'approved' ? <span className="pill">Pendente</span> : null}</div></div><div className="post-card-footer"><div className="user-chip"><div className="avatar-circle avatar-mini">{getInitial(detail.creator?.displayName, 'P')}</div><div><strong>{detail.name}</strong><p>{item.sport?.name}</p></div></div><Link className="secondary-button small-link-button" to={`/eventos/${item.id}`}>Ver evento</Link></div></article>) : <div className="side-card empty-state"><p className="muted-text">Esse pico ainda nao tem eventos publicados.</p></div>}</div>

        <div className="section-title"><h2>Feed do pico</h2><span>{detail.feedPosts.length}</span></div>
        <div className="list-stack">{detail.feedPosts.length ? detail.feedPosts.map((item) => <SocialPostCard key={item.id} item={{ ...item, pico: { slug: detail.slug, name: detail.name } }} token={token} currentUser={user} onUpdated={handleMediaUpdated} onDeleted={handleMediaDeleted} showPicoLink={false} />) : <div className="side-card empty-state"><p className="muted-text">Esse pico ainda nao tem posts publicados pela comunidade.</p></div>}</div>
      </div>

      <aside className="page-column rail-column">
        <div className="side-card sticky-card">
          <div className="section-title"><h2>Acoes do pico</h2><span>topo da pagina</span></div>
          <p className="muted-text">As criacoes ficam sempre no topo para nao sumirem quando o feed cresce.</p>
          <div className="list-stack compact-list">
            {detail.permissions?.canPost ? <button className="list-item" type="button" onClick={() => { setShowPostComposer(true); setShowEventComposer(false) }}><div><strong>Nova publicacao</strong><p>Foto ou video direto no feed do pico</p></div><span>Abrir</span></button> : null}
            {(detail.permissions?.canManageEvents || user?.permissions?.includes('event.submit')) ? <button className="list-item" type="button" onClick={() => { setShowEventComposer(true); setShowPostComposer(false) }}><div><strong>{detail.permissions?.canManageEvents ? 'Novo evento' : 'Sugerir evento'}</strong><p>Eventos passam por aprovacao quando necessario</p></div><span>Abrir</span></button> : null}
            {!user ? <Link className="primary-button small-link-button full-width" to="/entrar">Entrar para interagir</Link> : null}
          </div>

          <div className="section-divider" />
          <div className="section-title"><h2>Vaquinha</h2><span>{activeCampaign ? 'ativa' : 'nova'}</span></div>
          {activeCampaign ? (
            <form className="form-card compact-form" onSubmit={handleContribution}>
              <div className="stats-stack"><article><span>{activeCampaign.title}</span><strong>{activeCampaign.raisedLabel}</strong></article></div>
              <label>Contribuir em reais<input value={contributionAmount} onChange={(event) => setContributionAmount(event.target.value)} /></label>
              <button className="primary-button full-width">Contribuir</button>
            </form>
          ) : detail.permissions?.canManageEvents ? (
            <form className="form-card compact-form" onSubmit={handleCampaignSubmit}>
              <label>Titulo<input value={campaignForm.title} onChange={(event) => setCampaignForm((current) => ({ ...current, title: event.target.value }))} /></label>
              <label>Objetivo<textarea rows="3" value={campaignForm.purpose} onChange={(event) => setCampaignForm((current) => ({ ...current, purpose: event.target.value }))} /></label>
              <label>Meta em centavos<input value={campaignForm.goalCents} onChange={(event) => setCampaignForm((current) => ({ ...current, goalCents: Number(event.target.value) }))} /></label>
              <button className="primary-button full-width">Abrir vaquinha</button>
            </form>
          ) : <p className="muted-text">Somente administradores desse pico podem abrir vaquinhas.</p>}

          {detail.permissions?.canManageAdmins ? (
            <>
              <div className="section-divider" />
              <div className="section-title"><h2>Adicionar admin</h2><span>pico</span></div>
              <form className="form-card compact-form" onSubmit={handleAddAdmin}>
                <label>Pessoa<select value={adminUserId} onChange={(event) => setAdminUserId(event.target.value)}><option value="">Selecione</option>{people.filter((person) => !detail.admins.some((admin) => admin.id === person.id)).map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
                <button className="secondary-button full-width" type="submit" disabled={!adminUserId}>Adicionar administrador</button>
              </form>
            </>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}
        </div>
      </aside>
    </section>
  )
}
