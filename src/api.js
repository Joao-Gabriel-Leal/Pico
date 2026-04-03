const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  return `${apiBaseUrl}${path}`
}

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(buildUrl(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || 'Nao foi possivel concluir a requisicao.')
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
