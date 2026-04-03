import { createHash, randomUUID } from 'node:crypto'
import dotenv from 'dotenv'

dotenv.config({ quiet: true })

function normalizeEnvValue(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
}

function getCloudinaryConfig() {
  const CLOUDINARY_CLOUD_NAME = normalizeEnvValue(process.env.CLOUDINARY_CLOUD_NAME)
  const CLOUDINARY_API_KEY = normalizeEnvValue(process.env.CLOUDINARY_API_KEY)
  const CLOUDINARY_API_SECRET = normalizeEnvValue(process.env.CLOUDINARY_API_SECRET)
  const CLOUDINARY_UPLOAD_FOLDER = normalizeEnvValue(process.env.CLOUDINARY_UPLOAD_FOLDER)

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.')
  }

  return {
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    apiSecret: CLOUDINARY_API_SECRET,
    folder: CLOUDINARY_UPLOAD_FOLDER || 'picomap/demo',
  }
}

function makeSignature(params, apiSecret) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  return createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex')
}

function normalizeFilename(filename, kind) {
  const fallback = kind === 'video' ? 'video-upload' : 'image-upload'
  const safe = String(filename || fallback)
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return safe || fallback
}

export async function uploadToCloudinary({ buffer, filename, mimetype, kind }) {
  const { cloudName, apiKey, apiSecret, folder } = getCloudinaryConfig()
  const resourceType = kind === 'video' ? 'video' : 'image'
  const timestamp = Math.floor(Date.now() / 1000)
  const publicId = `${resourceType}-${Date.now()}-${randomUUID()}`
  const signature = makeSignature(
    {
      folder,
      public_id: publicId,
      timestamp,
    },
    apiSecret,
  )

  const formData = new FormData()
  formData.append('file', new Blob([buffer], { type: mimetype || 'application/octet-stream' }), normalizeFilename(filename, kind))
  formData.append('api_key', apiKey)
  formData.append('folder', folder)
  formData.append('public_id', publicId)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok || !payload.secure_url) {
    throw new Error(payload.error?.message || 'Nao foi possivel enviar a midia para a nuvem.')
  }

  return {
    url: payload.secure_url,
    publicId: payload.public_id,
    resourceType: payload.resource_type,
  }
}

function extractCloudinaryAsset(url) {
  if (!url) return null

  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    const uploadIndex = parts.findIndex((item) => item === 'upload')

    if (uploadIndex < 1) return null

    const resourceType = parts[uploadIndex - 1]
    const publicIdParts = parts.slice(uploadIndex + 1)
    if (!publicIdParts.length) return null

    if (/^v\d+$/.test(publicIdParts[0])) {
      publicIdParts.shift()
    }

    if (!publicIdParts.length) return null

    const lastPart = publicIdParts[publicIdParts.length - 1]
    publicIdParts[publicIdParts.length - 1] = lastPart.replace(/\.[^.]+$/, '')

    return {
      resourceType,
      publicId: publicIdParts.join('/'),
    }
  } catch {
    return null
  }
}

export async function deleteCloudinaryAsset({ publicId, resourceType = 'image' }) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = makeSignature(
    {
      invalidate: true,
      public_id: publicId,
      timestamp,
    },
    apiSecret,
  )

  const formData = new FormData()
  formData.append('public_id', publicId)
  formData.append('invalidate', 'true')
  formData.append('api_key', apiKey)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
    method: 'POST',
    body: formData,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Nao foi possivel remover a midia da nuvem.')
  }

  return payload.result === 'ok' || payload.result === 'not found'
}

export async function deleteCloudinaryAssetFromUrl(url) {
  const asset = extractCloudinaryAsset(url)
  if (!asset) return false
  return deleteCloudinaryAsset(asset)
}
