import { distanceBetween } from './geo'

export const routeStorageKey = 'picohunter_routes_v1'
export const routeInteractionsStorageKey = 'picohunter_route_interactions_v1'
export const routeUpdateEvent = 'picohunter:routes-updated'

const routeSportOptions = [
  { slug: 'bike', name: 'Bike', color: '#22c55e', speedKmh: 18 },
  { slug: 'corrida', name: 'Corrida', color: '#3b82f6', speedKmh: 10 },
  { slug: 'caminhada', name: 'Caminhada', color: '#f59e0b', speedKmh: 5 },
  { slug: 'natacao', name: 'Natacao', color: '#06b6d4', speedKmh: 3 },
  { slug: 'skate', name: 'Skate', color: '#8b5cf6', speedKmh: 12 },
]

const routeDifficultyOptions = [
  { slug: 'facil', name: 'Facil' },
  { slug: 'medio', name: 'Medio' },
  { slug: 'dificil', name: 'Dificil' },
]

function canUseStorage(kind) {
  try {
    return typeof window !== 'undefined' && Boolean(window[kind])
  } catch {
    return false
  }
}

function safeNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function createId(prefix = 'route') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function readStorage(key, fallback) {
  if (!canUseStorage('localStorage')) return fallback

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  if (!canUseStorage('localStorage')) return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

function notifyRoutesUpdated() {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent(routeUpdateEvent))
}

function getStoredRoutesRaw() {
  const items = readStorage(routeStorageKey, [])
  return Array.isArray(items) ? items : []
}

function getStoredInteractionsRaw() {
  const value = readStorage(routeInteractionsStorageKey, {})
  return value && typeof value === 'object' ? value : {}
}

function writeRoutesRaw(items) {
  writeStorage(routeStorageKey, items)
  notifyRoutesUpdated()
}

function writeInteractionsRaw(items) {
  writeStorage(routeInteractionsStorageKey, items)
  notifyRoutesUpdated()
}

function normalizePoint(point) {
  const latitude = safeNumber(point?.latitude)
  const longitude = safeNumber(point?.longitude)

  if (latitude === null || longitude === null) return null

  return {
    latitude,
    longitude,
  }
}

function normalizeMediaItem(item) {
  if (!item?.fileUrl) return null

  return {
    id: item.id || createId('route-media'),
    title: String(item.title || '').trim() || 'Midia da rota',
    fileUrl: item.fileUrl,
    mediaType: item.mediaType === 'video' ? 'video' : 'photo',
  }
}

function normalizeComment(comment) {
  const text = String(comment?.text || '').trim()
  if (!text) return null

  return {
    id: comment.id || createId('route-comment'),
    text,
    createdAt: comment.createdAt || new Date().toISOString(),
    author: {
      id: comment.author?.id || '',
      username: comment.author?.username || '',
      displayName: comment.author?.displayName || 'PicoHunter',
      avatarUrl: comment.author?.avatarUrl || '',
    },
  }
}

function normalizeRoute(route) {
  const points = Array.isArray(route?.points) ? route.points.map(normalizePoint).filter(Boolean) : []
  if (points.length < 2) return null

  const sport = getRouteSport(route.sport)
  const difficulty = getRouteDifficulty(route.difficulty)
  const comments = Array.isArray(route.comments)
    ? route.comments.map(normalizeComment).filter(Boolean)
    : []
  const media = Array.isArray(route.media)
    ? route.media.map(normalizeMediaItem).filter(Boolean)
    : []

  return {
    id: route.id || createId(),
    name: String(route.name || '').trim() || 'Rota sem nome',
    sport: sport.slug,
    description: String(route.description || '').trim(),
    difficulty: difficulty.slug,
    distanceKm: safeNumber(route.distanceKm) ?? getRouteDistanceKm(points),
    estimatedMinutes:
      safeNumber(route.estimatedMinutes) ?? estimateRouteDurationMinutes(getRouteDistanceKm(points), sport.slug),
    points,
    media,
    createdAt: route.createdAt || new Date().toISOString(),
    authorSnapshot: {
      id: route.authorSnapshot?.id || '',
      username: route.authorSnapshot?.username || '',
      displayName: route.authorSnapshot?.displayName || 'PicoHunter',
      avatarUrl: route.authorSnapshot?.avatarUrl || '',
    },
    likesCount: Math.max(0, Number(route.likesCount || 0)),
    comments,
    savedByCurrentUser: Boolean(route.savedByCurrentUser),
  }
}

function normalizeInteraction(route, interaction) {
  return {
    likedByCurrentUser: Boolean(interaction?.likedByCurrentUser),
    likesCount: Math.max(0, Number(interaction?.likesCount ?? route.likesCount ?? 0)),
    savedByCurrentUser: Boolean(interaction?.savedByCurrentUser ?? route.savedByCurrentUser),
    comments: Array.isArray(interaction?.comments)
      ? interaction.comments.map(normalizeComment).filter(Boolean)
      : route.comments || [],
  }
}

function hydrateRoute(route) {
  const normalizedRoute = normalizeRoute(route)
  if (!normalizedRoute) return null

  const interactions = getStoredInteractionsRaw()
  const interaction = normalizeInteraction(normalizedRoute, interactions[normalizedRoute.id])
  const sport = getRouteSport(normalizedRoute.sport)
  const difficulty = getRouteDifficulty(normalizedRoute.difficulty)

  return {
    ...normalizedRoute,
    sportMeta: sport,
    difficultyMeta: difficulty,
    likesCount: interaction.likesCount,
    comments: interaction.comments,
    commentsCount: interaction.comments.length,
    savedByCurrentUser: interaction.savedByCurrentUser,
    likedByCurrentUser: interaction.likedByCurrentUser,
  }
}

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const binary = atob(`${normalized}${padding}`)
  const bytes = Uint8Array.from(binary, (item) => item.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function getRouteSportOptions() {
  return routeSportOptions
}

export function getRouteDifficultyOptions() {
  return routeDifficultyOptions
}

export function getRouteSport(sportSlug) {
  return routeSportOptions.find((item) => item.slug === sportSlug) || routeSportOptions[0]
}

export function getRouteDifficulty(difficultySlug) {
  return routeDifficultyOptions.find((item) => item.slug === difficultySlug) || routeDifficultyOptions[0]
}

export function createRouteAuthorSnapshot(user) {
  return {
    id: user?.id || '',
    username: user?.username || '',
    displayName: user?.displayName || 'PicoHunter',
    avatarUrl: user?.avatarUrl || '',
  }
}

export function getRouteDistanceKm(points) {
  if (!Array.isArray(points) || points.length < 2) return 0

  let total = 0

  for (let index = 1; index < points.length; index += 1) {
    total += distanceBetween(points[index - 1], points[index]) || 0
  }

  return Number(total.toFixed(2))
}

export function estimateRouteDurationMinutes(distanceKm, sportSlug) {
  const sport = getRouteSport(sportSlug)
  const speedKmh = Number(sport.speedKmh || 8)
  if (!distanceKm || !speedKmh) return 0
  return Math.max(1, Math.round((distanceKm / speedKmh) * 60))
}

export function formatRouteDistance(distanceKm) {
  return `${Number(distanceKm || 0).toFixed(1)} km`
}

export function formatRouteDuration(minutes) {
  const totalMinutes = Math.max(0, Number(minutes || 0))
  if (totalMinutes < 60) return `${totalMinutes} min`

  const hours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  if (!remainingMinutes) return `${hours} h`
  return `${hours} h ${remainingMinutes} min`
}

export function listStoredRoutes() {
  return getStoredRoutesRaw()
    .map(hydrateRoute)
    .filter(Boolean)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export function getStoredRouteById(routeId) {
  return listStoredRoutes().find((item) => item.id === routeId) || null
}

export function createRouteRecord({
  name,
  sport,
  description,
  difficulty,
  estimatedMinutes,
  points,
  media = [],
  authorSnapshot,
}) {
  const normalizedPoints = Array.isArray(points) ? points.map(normalizePoint).filter(Boolean) : []
  const routeDistanceKm = getRouteDistanceKm(normalizedPoints)

  return normalizeRoute({
    id: createId(),
    name,
    sport,
    description,
    difficulty,
    estimatedMinutes:
      safeNumber(estimatedMinutes) ?? estimateRouteDurationMinutes(routeDistanceKm, sport),
    distanceKm: routeDistanceKm,
    points: normalizedPoints,
    media,
    authorSnapshot,
    createdAt: new Date().toISOString(),
    likesCount: 0,
    comments: [],
    savedByCurrentUser: false,
  })
}

export function saveRouteRecord(route) {
  const normalizedRoute = normalizeRoute(route)
  if (!normalizedRoute) {
    throw new Error('A rota precisa ter pelo menos dois pontos validos.')
  }

  const currentRoutes = getStoredRoutesRaw()
  const nextRoutes = [normalizedRoute, ...currentRoutes.filter((item) => item.id !== normalizedRoute.id)]
  writeRoutesRaw(nextRoutes)

  const currentInteractions = getStoredInteractionsRaw()
  currentInteractions[normalizedRoute.id] = normalizeInteraction(normalizedRoute, currentInteractions[normalizedRoute.id])
  writeInteractionsRaw(currentInteractions)

  return hydrateRoute(normalizedRoute)
}

export function toggleRouteLike(routeId) {
  const route = getStoredRouteById(routeId)
  if (!route) throw new Error('Rota nao encontrada.')

  const interactions = getStoredInteractionsRaw()
  const current = normalizeInteraction(route, interactions[routeId])
  const likedByCurrentUser = !current.likedByCurrentUser

  interactions[routeId] = {
    ...current,
    likedByCurrentUser,
    likesCount: Math.max(0, current.likesCount + (likedByCurrentUser ? 1 : -1)),
  }

  writeInteractionsRaw(interactions)
  return getStoredRouteById(routeId)
}

export function toggleRouteSave(routeId) {
  const route = getStoredRouteById(routeId)
  if (!route) throw new Error('Rota nao encontrada.')

  const interactions = getStoredInteractionsRaw()
  const current = normalizeInteraction(route, interactions[routeId])

  interactions[routeId] = {
    ...current,
    savedByCurrentUser: !current.savedByCurrentUser,
  }

  writeInteractionsRaw(interactions)
  return getStoredRouteById(routeId)
}

export function addRouteComment(routeId, text, user) {
  const route = getStoredRouteById(routeId)
  if (!route) throw new Error('Rota nao encontrada.')

  const content = String(text || '').trim()
  if (!content) throw new Error('Escreva um comentario antes de enviar.')

  const interactions = getStoredInteractionsRaw()
  const current = normalizeInteraction(route, interactions[routeId])

  interactions[routeId] = {
    ...current,
    comments: [
      ...current.comments,
      {
        id: createId('route-comment'),
        text: content,
        createdAt: new Date().toISOString(),
        author: createRouteAuthorSnapshot(user),
      },
    ],
  }

  writeInteractionsRaw(interactions)
  return getStoredRouteById(routeId)
}

export function simplifyRoutePoints(points, maxPoints = 48) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points || []
  if (maxPoints < 3) return [points[0], points[points.length - 1]].filter(Boolean)

  const step = (points.length - 1) / (maxPoints - 1)
  const simplified = []

  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.min(points.length - 1, Math.round(index * step))
    simplified.push(points[sourceIndex])
  }

  return simplified.filter(Boolean)
}

export function serializeRouteForShare(route) {
  const normalizedRoute = normalizeRoute(route)
  if (!normalizedRoute) {
    throw new Error('Nao foi possivel preparar a rota para compartilhamento.')
  }

  const payload = {
    version: 1,
    route: {
      ...normalizedRoute,
      points: simplifyRoutePoints(normalizedRoute.points, 56),
      media: normalizedRoute.media.slice(0, 1),
      comments: [],
      likesCount: 0,
      savedByCurrentUser: false,
    },
  }

  return encodeBase64Url(JSON.stringify(payload))
}

export function deserializeSharedRoute(encodedPayload) {
  try {
    const parsed = JSON.parse(decodeBase64Url(encodedPayload))
    if (!parsed?.route) return null

    return normalizeRoute(parsed.route)
  } catch {
    return null
  }
}

export function importSharedRoute(encodedPayload) {
  const sharedRoute = deserializeSharedRoute(encodedPayload)
  if (!sharedRoute) return null

  const existing = getStoredRouteById(sharedRoute.id)
  if (existing) return existing

  return saveRouteRecord(sharedRoute)
}

export function isRouteWithinBounds(route, bounds) {
  if (!bounds) return true
  if (!route?.points?.length) return false

  return route.points.some(
    (point) =>
      point.latitude <= Number(bounds.north) &&
      point.latitude >= Number(bounds.south) &&
      point.longitude <= Number(bounds.east) &&
      point.longitude >= Number(bounds.west),
  )
}

export function getRouteCenter(route) {
  if (!route?.points?.length) return null

  const sum = route.points.reduce(
    (total, point) => ({
      latitude: total.latitude + point.latitude,
      longitude: total.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  )

  return {
    latitude: sum.latitude / route.points.length,
    longitude: sum.longitude / route.points.length,
  }
}

export function getRouteDistanceFromLocation(route, origin) {
  if (!route?.points?.length || !origin) return null

  return route.points.reduce((closest, point) => {
    const distanceKm = distanceBetween(origin, point)
    if (distanceKm === null) return closest
    if (closest === null) return distanceKm
    return Math.min(closest, distanceKm)
  }, null)
}

export function buildSharedRouteUrl(route, origin = '') {
  const encoded = serializeRouteForShare(route)
  return `${origin}/rotas/${route.id}?share=${encoded}`
}
