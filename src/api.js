const configuredApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const responseCache = new Map()

function shouldUseSameOrigin() {
  if (typeof window === 'undefined') return false

  const { hostname } = window.location
  return (
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
    hostname.endsWith('.vercel.app')
  )
}

function getApiBaseUrl() {
  return shouldUseSameOrigin() ? '' : configuredApiBaseUrl
}

function getCacheTtl(path, method, hasBody) {
  if (method !== 'GET' || hasBody) return 0

  const normalizedPath = String(path || '').split('?')[0]
  if (normalizedPath === '/api/auth/options') return 5 * 60 * 1000
  if (normalizedPath === '/api/bootstrap') return 60 * 1000

  return 0
}

function readCachedResponse(cacheKey) {
  const cached = responseCache.get(cacheKey)
  if (!cached) return null

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey)
    return null
  }

  return cached.payload
}

function writeCachedResponse(cacheKey, payload, ttl) {
  if (!ttl) return

  responseCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + ttl,
  })
}

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  return `${getApiBaseUrl()}${path}`
}

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const normalizedMethod = String(method || 'GET').toUpperCase()
  const cacheTtl = getCacheTtl(path, normalizedMethod, body !== undefined)
  const cacheKey = cacheTtl ? `${normalizedMethod}:${token || 'anon'}:${path}` : ''

  if (cacheKey) {
    const cached = readCachedResponse(cacheKey)
    if (cached) return cached
  }

  const headers = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const response = await fetch(buildUrl(path), {
    method: normalizedMethod,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || 'Nao foi possivel concluir a requisicao.')
  }

  if (cacheKey) {
    writeCachedResponse(cacheKey, payload, cacheTtl)
  }

  return payload
}

export async function uploadFile(path, { file, token }) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || 'Nao foi possivel enviar o arquivo.')
  }

  return payload
}
