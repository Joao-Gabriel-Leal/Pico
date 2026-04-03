import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import SportPicker from '../components/SportPicker'
import { formatLocation, getCurrentPosition } from '../utils/geo'

function toggleId(list, id) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

export default function AuthPage() {
  const navigate = useNavigate()
  const { login, register, user } = useAuth()
  const [mode, setMode] = useState('login')
  const [step, setStep] = useState(1)
  const [sports, setSports] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [capturingLocation, setCapturingLocation] = useState(false)
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  })
  const [registerForm, setRegisterForm] = useState({
    displayName: '',
    username: '',
    email: '',
    password: '',
    location: null,
    favoriteSportIds: [],
  })

  useEffect(() => {
    if (user) navigate('/mapa')
  }, [navigate, user])

  useEffect(() => {
    async function loadOptions() {
      const payload = await apiRequest('/api/auth/options')
      setSports(payload.sports)
    }

    loadOptions()
  }, [])

  async function captureLocation() {
    setCapturingLocation(true)
    setError('')

    try {
      const location = await getCurrentPosition()
      setRegisterForm((current) => ({ ...current, location }))
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setCapturingLocation(false)
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(loginForm)
      navigate('/mapa')
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await register(registerForm)
      navigate('/perfil')
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="section-title">
          <div>
            <p className="eyebrow">Entrar ou registrar</p>
            <h1>{mode === 'login' ? 'Acessar sua conta' : 'Criar conta por etapas'}</h1>
          </div>
          <Link className="text-link" to="/mapa">
            Voltar ao mapa
          </Link>
        </div>

        <div className="chip-row">
          <button className={mode === 'login' ? 'chip active' : 'chip'} onClick={() => setMode('login')}>
            Entrar
          </button>
          <button
            className={mode === 'register' ? 'chip active' : 'chip'}
            onClick={() => {
              setMode('register')
              setStep(1)
            }}
          >
            Registrar
          </button>
        </div>

        {mode === 'login' ? (
          <form className="form-card" onSubmit={handleLoginSubmit}>
            <label>
              Email
              <input
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
            {error ? <p className="error-text">{error}</p> : null}

            <button className="primary-button full-width" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form className="form-card" onSubmit={handleRegisterSubmit}>
            {step === 1 ? (
              <>
                <label>
                  Nome exibido
                  <input
                    value={registerForm.displayName}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, displayName: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Usuario
                  <input
                    value={registerForm.username}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, username: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Email
                  <input
                    value={registerForm.email}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Senha
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </label>

                <button
                  className="primary-button full-width"
                  type="button"
                  onClick={() => setStep(2)}
                >
                  Continuar
                </button>
              </>
            ) : (
              <>
                <div className="location-box">
                  <div>
                    <strong>Localizacao exata</strong>
                    <p>{formatLocation(registerForm.location)}</p>
                  </div>
                  <button className="secondary-button" type="button" onClick={captureLocation}>
                    {capturingLocation ? 'Capturando...' : 'Usar minha localizacao'}
                  </button>
                </div>

                <div>
                  <label>Esportes favoritos</label>
                  <SportPicker
                    sports={sports}
                    selectedIds={registerForm.favoriteSportIds}
                    onToggle={(sportId) =>
                      setRegisterForm((current) => ({
                        ...current,
                        favoriteSportIds: toggleId(current.favoriteSportIds, sportId),
                      }))
                    }
                    helperText="Voce pode selecionar mais de um esporte e editar isso depois no perfil."
                  />
                </div>

                <div className="inline-actions">
                  <button className="secondary-button" type="button" onClick={() => setStep(1)}>
                    Voltar
                  </button>
                  <button
                    className="primary-button"
                    disabled={
                      submitting ||
                      !registerForm.location ||
                      registerForm.favoriteSportIds.length === 0
                    }
                  >
                    {submitting ? 'Criando...' : 'Criar conta'}
                  </button>
                </div>
              </>
            )}

            {error ? <p className="error-text">{error}</p> : null}
          </form>
        )}
      </div>
    </section>
  )
}
