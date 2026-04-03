import { createContext, useContext, useEffect, useState } from 'react'
import { apiRequest } from './api'

const AuthContext = createContext(null)
const storageKey = 'picoliga_token'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(storageKey) || '')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function bootstrapAuth() {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const payload = await apiRequest('/api/me', { token })
        setUser(payload.user)
      } catch {
        localStorage.removeItem(storageKey)
        setToken('')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    bootstrapAuth()
  }, [token])

  function persist(tokenValue, userValue) {
    localStorage.setItem(storageKey, tokenValue)
    setToken(tokenValue)
    setUser(userValue)
  }

  async function login(form) {
    const payload = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: form,
    })
    persist(payload.token, payload.user)
    return payload.user
  }

  async function register(form) {
    const payload = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: form,
    })
    persist(payload.token, payload.user)
    return payload.user
  }

  async function refreshUser() {
    if (!token) return null
    const payload = await apiRequest('/api/me', { token })
    setUser(payload.user)
    return payload.user
  }

  function logout() {
    localStorage.removeItem(storageKey)
    setToken('')
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        login,
        register,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
