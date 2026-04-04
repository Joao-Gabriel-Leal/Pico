import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import { uploadSelectedFile } from '../utils/files'
import { formatLocation, getCurrentPosition, getPreferredLocation } from '../utils/geo'

function formatMapPoint(latitude, longitude) {
  if (latitude === '' || longitude === '') return 'Nenhum ponto definido ainda'
  return 'Ponto marcado no mapa'
}

export default function NewPicoPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { token, user, liveLocation } = useAuth()
  const [sports, setSports] = useState([])
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [galleryUploads, setGalleryUploads] = useState([])
  const [form, setForm] = useState({
    name: '',
    primarySportId: '',
    description: '',
    latitude: '',
    longitude: '',
    statusText: '',
    conditionLabel: '',
    coverImageUrl: '',
  })

  useEffect(() => {
    async function loadOptions() {
      const payload = await apiRequest('/api/auth/options')
      setSports(payload.sports)
    }

    loadOptions()
  }, [])

  useEffect(() => {
    const lat = Number(searchParams.get('lat'))
    const lng = Number(searchParams.get('lng'))

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setForm((current) => ({
        ...current,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }))
      return
    }

    const preferredLocation = getPreferredLocation(user?.location, liveLocation)
    if (!preferredLocation) return

    setForm((current) => ({
      ...current,
      latitude: current.latitude || Number(preferredLocation.latitude).toFixed(6),
      longitude: current.longitude || Number(preferredLocation.longitude).toFixed(6),
    }))
  }, [liveLocation, searchParams, user])

  const locationPreview = useMemo(() => {
    if (!form.latitude || !form.longitude) return 'Escolha um ponto no mapa ou use sua localizacao exata.'
    return formatMapPoint(form.latitude, form.longitude)
  }, [form.latitude, form.longitude])

  async function useCurrentLocation() {
    setLoadingLocation(true)
    setError('')

    try {
      const location = await getCurrentPosition({ force: true })
      setForm((current) => ({
        ...current,
        latitude: location.latitude.toFixed(6),
        longitude: location.longitude.toFixed(6),
      }))
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setLoadingLocation(false)
    }
  }

  async function handleCoverChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingCover(true)
    setError('')

    try {
      const uploadedUrl = await uploadSelectedFile(file, {
        token,
        kind: 'image',
      })
      setForm((current) => ({ ...current, coverImageUrl: uploadedUrl }))
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setUploadingCover(false)
      event.target.value = ''
    }
  }

  async function handleGalleryFilesChange(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    setUploadingGallery(true)
    setError('')

    try {
      const uploadedItems = []

      for (const file of files) {
        const kind = file.type.startsWith('video/') ? 'video' : 'image'
        const uploadedUrl = await uploadSelectedFile(file, {
          token,
          kind,
        })

        uploadedItems.push({
          title: file.name.replace(/\.[^.]+$/, ''),
          fileUrl: uploadedUrl,
          mediaType: kind === 'video' ? 'video' : 'photo',
        })
      }

      setGalleryUploads((current) => [...current, ...uploadedItems])
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setUploadingGallery(false)
      event.target.value = ''
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    try {
      const payload = await apiRequest('/api/picos', {
        method: 'POST',
        token,
        body: form,
      })

      for (const mediaItem of galleryUploads) {
        await apiRequest(`/api/picos/${payload.item.slug}/media`, {
          method: 'POST',
          token,
          body: {
            ...mediaItem,
            scope: 'gallery',
          },
        })
      }

      setMessage(
        user.permissions?.includes('pico.approve')
          ? 'Pico criado com sucesso.'
          : 'Pico enviado para aprovacao da administracao.',
      )
      navigate(`/picos/${payload.item.slug}`)
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <h1>Entre para marcar um pico</h1>
          <Link className="primary-button small-link-button" to="/entrar">
            Entrar para criar pico
          </Link>
        </div>
      </section>
    )
  }

  if (!user.permissions?.includes('pico.create')) {
    return (
      <section className="simple-page">
        <div className="side-card">
          <h1>Sem permissao para criar pico</h1>
          <Link className="primary-button small-link-button" to="/perfil">
            Voltar para perfil
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="simple-page">
      <div className="side-card">
        <div className="section-title">
          <div>
            <p className="eyebrow">PicoHunter</p>
            <h1>Novo pico</h1>
          </div>
          <button className="secondary-button" onClick={useCurrentLocation} type="button">
            {loadingLocation ? 'Lendo localizacao...' : 'Usar minha localizacao exata'}
          </button>
        </div>

        <form className="form-card" onSubmit={handleSubmit}>
          <label>
            Nome do pico
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>

          <label>
            Esporte principal
            <select
              value={form.primarySportId}
              onChange={(event) =>
                setForm((current) => ({ ...current, primarySportId: Number(event.target.value) }))
              }
            >
              <option value="">Selecione</option>
              {sports.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Descricao
            <textarea
              rows="4"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>

          <div className="location-box">
            <div>
              <strong>Ponto do pico</strong>
              <p>{locationPreview}</p>
              <p>{user.location ? formatLocation(user.location) : 'Seu perfil ainda nao capturou localizacao.'}</p>
            </div>
            <Link className="secondary-button small-link-button" to="/mapa">
              Escolher no mapa
            </Link>
          </div>

          <div className="two-column-grid">
            <label>
              Status atual
              <input
                value={form.statusText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, statusText: event.target.value }))
                }
                placeholder="ex: seco e movimentado"
              />
            </label>

            <label>
              Selo rapido
              <input
                value={form.conditionLabel}
                onChange={(event) =>
                  setForm((current) => ({ ...current, conditionLabel: event.target.value }))
                }
                placeholder="ex: quente"
              />
            </label>
          </div>

          <label>
            Foto de capa do pico
            <input type="file" accept="image/*" onChange={handleCoverChange} />
          </label>

          {form.coverImageUrl ? (
            <img className="image-preview" src={form.coverImageUrl} alt="Capa do pico" />
          ) : null}

          <label>
            Fotos e videos de apresentacao
            <input type="file" accept="image/*,video/*" multiple onChange={handleGalleryFilesChange} />
          </label>

          {galleryUploads.length ? (
            <div className="upload-list">
              {galleryUploads.map((item, index) => (
                <div key={`${item.fileUrl}-${index}`} className="list-item static-item">
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.mediaType === 'video' ? 'Video de apresentacao' : 'Foto de apresentacao'}</p>
                  </div>
                  <button
                    className="ghost-button small-button"
                    type="button"
                    onClick={() =>
                      setGalleryUploads((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}

          <button
            className="primary-button full-width"
            disabled={saving || uploadingCover || uploadingGallery || !form.latitude || !form.longitude}
          >
            {saving
              ? 'Salvando...'
              : user.permissions?.includes('pico.approve')
                ? 'Criar pico'
                : 'Enviar pico para aprovacao'}
          </button>
        </form>
      </div>
    </section>
  )
}
