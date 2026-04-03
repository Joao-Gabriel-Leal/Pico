import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pingDatabase, query, withTransaction } from './db.js'

function safeNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format((Number(value) || 0) / 100)
}

function distanceBetweenLocations(origin, target) {
  if (!origin || !target) return null

  const toRad = (value) => (value * Math.PI) / 180
  const earthRadius = 6371
  const deltaLat = toRad(Number(target.latitude) - Number(origin.latitude))
  const deltaLng = toRad(Number(target.longitude) - Number(origin.longitude))
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRad(Number(origin.latitude))) *
      Math.cos(toRad(Number(target.latitude))) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2)

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase()
}

function normalizeUsername(value) {
  return normalizeString(value).toLowerCase()
}

function normalizeLocation(location) {
  if (!location) return null

  const latitude = safeNumber(location.latitude)
  const longitude = safeNumber(location.longitude)
  if (latitude === null || longitude === null) return null

  return {
    latitude,
    longitude,
    accuracy: safeNumber(location.accuracy),
    updatedAt: location.updatedAt || new Date().toISOString(),
  }
}

function normalizeFavoriteSportIds(favoriteSportIds) {
  if (!Array.isArray(favoriteSportIds)) return []
  return [...new Set(favoriteSportIds.map((item) => Number(item)).filter(Number.isInteger))]
}

function buildLocationFromRow(row) {
  const latitude = safeNumber(row.latitude)
  const longitude = safeNumber(row.longitude)
  if (latitude === null || longitude === null) return null

  return {
    latitude,
    longitude,
    accuracy: safeNumber(row.location_accuracy),
    updatedAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  }
}

function mapSportRow(row, prefix = 'sport_') {
  const id = Number(row[`${prefix}id`])
  const slug = row[`${prefix}slug`]
  const name = row[`${prefix}name`]

  if (!id || !slug || !name) return null

  return { id, slug, name }
}

function mapUserViewRow(row) {
  const roles = Array.isArray(row.roles)
    ? row.roles.map((item) => ({
        id: Number(item.id),
        slug: item.slug,
        name: item.name,
      }))
    : []

  const permissionKeys = Array.isArray(row.permission_keys) ? row.permission_keys : []

  const favoriteSports = Array.isArray(row.favorite_sports)
    ? row.favorite_sports.map((item) => ({
        id: Number(item.id),
        slug: item.slug,
        name: item.name,
      }))
    : []

  const favoriteSportIds = Array.isArray(row.favorite_sport_ids)
    ? row.favorite_sport_ids.map((item) => Number(item))
    : []

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio || '',
    avatarUrl: row.avatar_url || '',
    location: buildLocationFromRow(row),
    favoriteSportIds,
    favoriteSports,
    roles,
    permissions: permissionKeys,
    createdPicoCount: Number(row.created_pico_count || 0),
    followerCount: Number(row.follower_count || 0),
    followingCount: Number(row.following_count || 0),
    mediaCount: Number(row.media_count || 0),
    isFollowing: Boolean(row.is_following),
    followsYou: Boolean(row.follows_you),
  }
}

function mapPublicUser(user) {
  if (!user) return null

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    favoriteSports: user.favoriteSports,
    roles: user.roles,
    createdPicoCount: user.createdPicoCount,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    mediaCount: user.mediaCount,
    isFollowing: user.isFollowing,
    followsYou: user.followsYou,
  }
}

function mapCampaign(row) {
  return {
    id: row.id,
    picoId: row.pico_id,
    createdBy: row.created_by,
    title: row.title,
    purpose: row.purpose,
    goalCents: Number(row.goal_cents),
    amountRaisedCents: Number(row.amount_raised_cents),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    goalLabel: money(row.goal_cents),
    raisedLabel: money(row.amount_raised_cents),
  }
}

function mapMediaRow(row) {
  return {
    id: row.id,
    picoId: row.pico_id,
    userId: row.user_id,
    mediaType: row.media_type,
    title: row.title,
    fileUrl: row.file_url,
    likesCount: Number(row.likes_count || 0),
    commentsCount: Number(row.comments_count || 0),
    viewsCount: Number(row.views_count || 0),
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function mapEventRow(row) {
  return {
    id: row.id,
    picoId: row.pico_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description || '',
    sportId: Number(row.sport_id),
    startsAt: new Date(row.starts_at).toISOString(),
    entryFeeCents: Number(row.entry_fee_cents || 0),
    prizePoolCents: Number(row.prize_pool_cents || 0),
    approvalStatus: row.approval_status || 'approved',
    createdAt: new Date(row.created_at).toISOString(),
    sport: mapSportRow(row),
    entryFeeLabel: money(row.entry_fee_cents),
    prizePoolLabel: money(row.prize_pool_cents),
  }
}

async function ensureSportIdsExist(client, sportIds) {
  const normalizedIds = normalizeFavoriteSportIds(sportIds)
  if (!normalizedIds.length) return []

  const { rows } = await client.query('select id from sport where id = any($1::int[])', [normalizedIds])
  const validIds = rows.map((row) => Number(row.id))

  if (validIds.length !== normalizedIds.length) {
    throw new Error('Selecione esportes validos.')
  }

  return normalizedIds
}

async function getSports(client = { query }) {
  const { rows } = await client.query('select id, slug, name from sport order by id')
  return rows.map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
  }))
}

async function getRoles(client = { query }) {
  const { rows } = await client.query('select id, slug, name, description from role order by id')
  return rows.map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description || '',
  }))
}

async function getUserRoleRows(client, userId) {
  const { rows } = await client.query(
    `
      select role.id, role.slug, role.name
      from user_role
      join role on role.id = user_role.role_id
      where user_role.user_id = $1
      order by role.id
    `,
    [userId],
  )

  return rows.map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
  }))
}

async function getUserPermissionKeys(client, userId) {
  const { rows } = await client.query(
    `
      select distinct permission.key
      from user_role
      join role_permission on role_permission.role_id = user_role.role_id
      join permission on permission.id = role_permission.permission_id
      where user_role.user_id = $1
      order by permission.key
    `,
    [userId],
  )

  return rows.map((row) => row.key)
}

async function ensureRoleBySlug(client, slug) {
  const { rows } = await client.query('select id from role where slug = $1', [slug])
  if (!rows.length) {
    throw new Error(`Role ${slug} ainda nao foi cadastrada.`)
  }
  return Number(rows[0].id)
}

async function ensureUserBaseRoles(client, userId) {
  const userRoleRows = await getUserRoleRows(client, userId)
  if (userRoleRows.length) return userRoleRows

  const roleId = await ensureRoleBySlug(client, 'usuario')
  await client.query(
    `
      insert into user_role (user_id, role_id, granted_by)
      values ($1, $2, $1)
      on conflict do nothing
    `,
    [userId, roleId],
  )

  return getUserRoleRows(client, userId)
}

async function ensureBootstrapAdmin(client, userId) {
  const { rows } = await client.query(
    `
      select 1
      from user_role
      join role on role.id = user_role.role_id
      where role.slug = 'admin'
      limit 1
    `,
  )

  if (rows.length) return

  const adminRoleId = await ensureRoleBySlug(client, 'admin')
  await client.query(
    `
      insert into user_role (user_id, role_id, granted_by)
      values ($1, $2, $1)
      on conflict do nothing
    `,
    [userId, adminRoleId],
  )
}

async function ensureUserAccessState(client, userId) {
  await ensureUserBaseRoles(client, userId)
  await ensureBootstrapAdmin(client, userId)
}

function hasPermission(permissionKeys, permissionKey) {
  return Array.isArray(permissionKeys) && permissionKeys.includes(permissionKey)
}

function canApprovePicos(permissionKeys) {
  return hasPermission(permissionKeys, 'pico.approve') || hasPermission(permissionKeys, 'pico.manage.any')
}

function canApproveEvents(permissionKeys) {
  return hasPermission(permissionKeys, 'event.approve') || hasPermission(permissionKeys, 'event.manage.any')
}

async function getUserLocationById(client, userId) {
  if (!userId) return null

  const { rows } = await client.query(
    `
      select latitude, longitude, location_accuracy
      from app_user
      where id = $1
    `,
    [userId],
  )

  return rows[0] ? buildLocationFromRow(rows[0]) : null
}

async function getUserIdByToken(client, token) {
  const { rows } = await client.query('select user_id from auth_session where token = $1', [token])
  return rows[0]?.user_id || null
}

async function getUserViewById(client, userId, currentUserId = userId) {
  const { rows } = await client.query(
    `
      select
        app_user.id,
        app_user.email,
        app_user.username,
        app_user.latitude,
        app_user.longitude,
        app_user.location_accuracy,
        app_user.created_at,
        profile.display_name,
        profile.bio,
        profile.avatar_url,
        coalesce(followers.total, 0)::int as follower_count,
        coalesce(following.total, 0)::int as following_count,
        coalesce(media.total, 0)::int as media_count,
        coalesce(created_picos.total, 0)::int as created_pico_count,
        exists(
          select 1
          from user_follow follow_check
          where follow_check.follower_id = $2::uuid
            and follow_check.following_id = app_user.id
        ) as is_following,
        exists(
          select 1
          from user_follow follow_back
          where follow_back.follower_id = app_user.id
            and follow_back.following_id = $2::uuid
        ) as follows_you,
        coalesce(access_roles.roles, '[]'::json) as roles,
        coalesce(access_permissions.permission_keys, '[]'::json) as permission_keys,
        coalesce(favorites.favorite_sports, '[]'::json) as favorite_sports,
        coalesce(favorites.favorite_sport_ids, '[]'::json) as favorite_sport_ids
      from app_user
      join profile on profile.user_id = app_user.id
      left join lateral (
        select count(*)::int as total
        from user_follow
        where following_id = app_user.id
      ) followers on true
      left join lateral (
        select count(*)::int as total
        from user_follow
        where follower_id = app_user.id
      ) following on true
      left join lateral (
        select count(*)::int as total
        from pico_media
        where user_id = app_user.id
      ) media on true
      left join lateral (
        select count(*)::int as total
        from pico
        where created_by = app_user.id
      ) created_picos on true
      left join lateral (
        select json_agg(
          json_build_object('id', role_rows.id, 'slug', role_rows.slug, 'name', role_rows.name)
          order by role_rows.id
        ) as roles
        from (
          select role.id, role.slug, role.name
          from user_role
          join role on role.id = user_role.role_id
          where user_role.user_id = app_user.id
          order by role.id
        ) role_rows
      ) access_roles on true
      left join lateral (
        select json_agg(permission_rows.permission_key order by permission_rows.permission_key) as permission_keys
        from (
          select distinct permission.key as permission_key
          from user_role
          join role_permission on role_permission.role_id = user_role.role_id
          join permission on permission.id = role_permission.permission_id
          where user_role.user_id = app_user.id
        ) permission_rows
      ) access_permissions on true
      left join lateral (
        select
          json_agg(
            json_build_object('id', sport.id, 'slug', sport.slug, 'name', sport.name)
            order by sport.id
          ) as favorite_sports,
          json_agg(sport.id order by sport.id) as favorite_sport_ids
        from user_favorite_sport favorite
        join sport on sport.id = favorite.sport_id
        where favorite.user_id = app_user.id
      ) favorites on true
      where app_user.id = $1
    `,
    [userId, currentUserId],
  )

  return rows[0] ? mapUserViewRow(rows[0]) : null
}

async function getPublicUserViewById(client, userId, currentUserId = null) {
  const user = await getUserViewById(client, userId, currentUserId)
  return mapPublicUser(user)
}

async function getPicoSummaryRowById(client, picoId, currentUserId = null) {
  const { rows } = await client.query(
    `
      select
        pico.id,
        pico.created_by,
        pico.primary_sport_id,
        pico.name,
        pico.slug,
        pico.description,
        pico.latitude,
        pico.longitude,
        pico.status_text,
        pico.condition_label,
        pico.cover_image_url,
        pico.approval_status,
        pico.approved_by,
        pico.approved_at,
        pico.created_at,
        sport.id as sport_id,
        sport.slug as sport_slug,
        sport.name as sport_name,
        coalesce(votes.total, 0)::int as vote_count,
        coalesce(media.total, 0)::int as media_count,
        coalesce(events.total, 0)::int as upcoming_events_count,
        exists(
          select 1
          from pico_vote
          where pico_vote.pico_id = pico.id
            and pico_vote.user_id = $2::uuid
        ) as has_voted,
        coalesce(nullif(pico.cover_image_url, ''), preview.file_url, '') as preview_photo,
        active_campaign.id as active_campaign_id,
        active_campaign.title as active_campaign_title,
        active_campaign.purpose as active_campaign_purpose,
        active_campaign.goal_cents as active_campaign_goal_cents,
        active_campaign.amount_raised_cents as active_campaign_amount_raised_cents
      from pico
      join sport on sport.id = pico.primary_sport_id
      left join lateral (
        select count(*)::int as total
        from pico_vote
        where pico_vote.pico_id = pico.id
      ) votes on true
      left join lateral (
        select count(*)::int as total
        from pico_media
        where pico_media.pico_id = pico.id
      ) media on true
      left join lateral (
        select count(*)::int as total
        from pico_event
        where pico_event.pico_id = pico.id
      ) events on true
      left join lateral (
        select file_url
        from pico_media
        where pico_id = pico.id
          and media_type = 'photo'
          and file_url <> ''
        order by created_at desc
        limit 1
      ) preview on true
      left join lateral (
        select id, title, purpose, goal_cents, amount_raised_cents
        from crowdfunding_campaign
        where pico_id = pico.id
          and status = 'active'
        order by created_at desc
        limit 1
      ) active_campaign on true
      where pico.id = $1
    `,
    [picoId, currentUserId],
  )

  return rows[0] || null
}

async function buildPicoSummary(client, picoId, currentUserId = null) {
  const row = await getPicoSummaryRowById(client, picoId, currentUserId)
  if (!row) return null

  const [creator, permissions] = await Promise.all([
    getPublicUserViewById(client, row.created_by, currentUserId),
    getPicoPermissionsForUser(client, picoId, currentUserId),
  ])
  const sport = mapSportRow(row)

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    statusText: row.status_text,
    conditionLabel: row.condition_label,
    approvalStatus: row.approval_status || 'approved',
    sport,
    creator,
    mediaCount: Number(row.media_count || 0),
    upcomingEventsCount: Number(row.upcoming_events_count || 0),
    voteCount: Number(row.vote_count || 0),
    hasVoted: Boolean(row.has_voted),
    previewPhoto: row.preview_photo || '',
    coverImageUrl: row.cover_image_url || '',
    permissions,
    activeCampaign: row.active_campaign_id
      ? {
          id: row.active_campaign_id,
          title: row.active_campaign_title,
          purpose: row.active_campaign_purpose,
          goalCents: Number(row.active_campaign_goal_cents),
          amountRaisedCents: Number(row.active_campaign_amount_raised_cents),
          goalLabel: money(row.active_campaign_goal_cents),
          raisedLabel: money(row.active_campaign_amount_raised_cents),
        }
      : null,
  }
}

function toCompactPico(summary) {
  if (!summary) return null

  return {
    id: summary.id,
    slug: summary.slug,
    name: summary.name,
    sport: summary.sport,
    latitude: summary.latitude,
    longitude: summary.longitude,
    previewPhoto: summary.previewPhoto,
    conditionLabel: summary.conditionLabel,
    voteCount: summary.voteCount,
    statusText: summary.statusText,
  }
}

async function getPicoIdBySlug(client, slug) {
  const { rows } = await client.query('select id from pico where slug = $1', [slug])
  return rows[0]?.id || null
}

async function canViewPico(client, picoId, currentUserId = null) {
  const summary = await getPicoSummaryRowById(client, picoId, currentUserId)
  if (!summary) return false
  if ((summary.approval_status || 'approved') === 'approved') return true
  if (!currentUserId) return false
  if (summary.created_by === currentUserId) return true

  const permissionKeys = await getUserPermissionKeys(client, currentUserId)
  if (canApprovePicos(permissionKeys)) return true
  return isPicoAdmin(client, picoId, currentUserId)
}

async function isPicoAdmin(client, picoId, userId) {
  if (!userId) return false

  const { rows } = await client.query(
    `
      select 1
      from pico_admin
      where pico_id = $1
        and user_id = $2
    `,
    [picoId, userId],
  )

  return Boolean(rows[0])
}

function emptyPicoPermissions() {
  return {
    isPicoAdmin: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canManageEvents: false,
    canModerateContent: false,
    canManageAdmins: false,
    canApprovePico: false,
    canApproveEvents: false,
    canPost: false,
  }
}

function emptyMediaPermissions() {
  return {
    canLike: false,
    canComment: false,
    canDelete: false,
  }
}

async function getPicoPermissionsForUser(client, picoId, userId) {
  if (!userId) return emptyPicoPermissions()

  const [permissionKeys, picoAdminFlag] = await Promise.all([
    getUserPermissionKeys(client, userId),
    isPicoAdmin(client, picoId, userId),
  ])

  const assignedManage = picoAdminFlag && hasPermission(permissionKeys, 'pico.manage.assigned')
  const assignedDelete = picoAdminFlag && hasPermission(permissionKeys, 'pico.delete.assigned')
  const assignedEvents = picoAdminFlag && hasPermission(permissionKeys, 'event.manage.assigned')
  const assignedModeration = picoAdminFlag && hasPermission(permissionKeys, 'media.moderate.assigned')
  const assignedAdminManagement =
    picoAdminFlag && hasPermission(permissionKeys, 'pico.admin.manage.assigned')

  return {
    isPicoAdmin: picoAdminFlag,
    canCreate: hasPermission(permissionKeys, 'pico.create'),
    canEdit: hasPermission(permissionKeys, 'pico.manage.any') || assignedManage,
    canDelete: hasPermission(permissionKeys, 'pico.delete.any') || assignedDelete,
    canManageEvents: hasPermission(permissionKeys, 'event.manage.any') || assignedEvents,
    canModerateContent: hasPermission(permissionKeys, 'media.moderate.any') || assignedModeration,
    canManageAdmins: hasPermission(permissionKeys, 'pico.admin.manage.any') || assignedAdminManagement,
    canApprovePico: canApprovePicos(permissionKeys),
    canApproveEvents: canApproveEvents(permissionKeys),
    canPost: hasPermission(permissionKeys, 'feed.post'),
  }
}

async function ensurePicoPermission(client, picoId, userId, permissionName, fallbackMessage) {
  const permissions = await getPicoPermissionsForUser(client, picoId, userId)
  if (!permissions[permissionName]) {
    throw new Error(fallbackMessage)
  }
  return permissions
}

async function listPicoAdmins(client, picoId, currentUserId = null) {
  const { rows } = await client.query(
    `
      select user_id
      from pico_admin
      where pico_id = $1
      order by created_at asc
    `,
    [picoId],
  )

  const admins = (
    await Promise.all(rows.map((row) => getPublicUserViewById(client, row.user_id, currentUserId)))
  ).filter(Boolean)

  return admins
}

async function listPicoVoters(client, picoId, currentUserId = null) {
  const { rows } = await client.query(
    `
      select user_id
      from pico_vote
      where pico_id = $1
      order by created_at desc
      limit 24
    `,
    [picoId],
  )

  const people = (
    await Promise.all(rows.map((row) => getPublicUserViewById(client, row.user_id, currentUserId)))
  ).filter(Boolean)

  return people
}

async function listMediaLikes(client, mediaId, currentUserId = null) {
  const { rows } = await client.query(
    `
      select user_id
      from pico_media_like
      where media_id = $1
      order by created_at desc
      limit 12
    `,
    [mediaId],
  )

  const people = (
    await Promise.all(rows.map((row) => getPublicUserViewById(client, row.user_id, currentUserId)))
  ).filter(Boolean)

  return people
}

async function listMediaComments(client, mediaId, currentUserId = null) {
  const { rows } = await client.query(
    `
      select id, media_id, user_id, text_content, created_at
      from pico_media_comment
      where media_id = $1
      order by created_at asc
      limit 50
    `,
    [mediaId],
  )

  const uniqueUserIds = [...new Set(rows.map((row) => row.user_id))]
  const authors = new Map()

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      authors.set(userId, await getPublicUserViewById(client, userId, currentUserId))
    }),
  )

  return rows.map((row) => ({
    id: row.id,
    mediaId: row.media_id,
    userId: row.user_id,
    text: row.text_content,
    createdAt: new Date(row.created_at).toISOString(),
    author: authors.get(row.user_id) || null,
    isOwn: Boolean(currentUserId && row.user_id === currentUserId),
  }))
}

async function getMediaRowById(client, mediaId) {
  const { rows } = await client.query(
    `
      select
        id,
        pico_id,
        user_id,
        media_type,
        title,
        file_url,
        likes_count,
        comments_count,
        views_count,
        created_at
      from pico_media
      where id = $1
    `,
    [mediaId],
  )

  return rows[0] || null
}

async function getEventRowById(client, eventId) {
  const { rows } = await client.query(
    `
      select
        pico_event.id,
        pico_event.pico_id,
        pico_event.created_by,
        pico_event.title,
        pico_event.description,
        pico_event.sport_id,
        pico_event.starts_at,
        pico_event.entry_fee_cents,
        pico_event.prize_pool_cents,
        pico_event.approval_status,
        pico_event.created_at,
        sport.id as sport_id,
        sport.slug as sport_slug,
        sport.name as sport_name
      from pico_event
      join sport on sport.id = pico_event.sport_id
      where pico_event.id = $1
    `,
    [eventId],
  )

  return rows[0] || null
}

async function canViewEvent(client, eventId, currentUserId = null) {
  const row = await getEventRowById(client, eventId)
  if (!row) return false
  if ((row.approval_status || 'approved') === 'approved') return true
  if (!currentUserId) return false
  if (row.created_by === currentUserId) return true

  const permissionKeys = await getUserPermissionKeys(client, currentUserId)
  if (canApproveEvents(permissionKeys)) return true
  return isPicoAdmin(client, row.pico_id, currentUserId)
}

async function buildMediaDetail(client, row, currentUserId = null) {
  const [author, picoPermissions, likedBy, comments, likedRows, permissionKeys] = await Promise.all([
    getPublicUserViewById(client, row.user_id, currentUserId),
    getPicoPermissionsForUser(client, row.pico_id, currentUserId),
    listMediaLikes(client, row.id, currentUserId),
    listMediaComments(client, row.id, currentUserId),
    currentUserId
      ? client.query(
          `
            select 1
            from pico_media_like
            where media_id = $1
              and user_id = $2
          `,
          [row.id, currentUserId],
        )
      : Promise.resolve({ rows: [] }),
    currentUserId ? getUserPermissionKeys(client, currentUserId) : Promise.resolve([]),
  ])

  const isOwn = Boolean(currentUserId && row.user_id === currentUserId)
  const canDelete = picoPermissions.canModerateContent || isOwn

  return {
    ...mapMediaRow(row),
    author,
    likedBy,
    comments,
    isLiked: Boolean(likedRows.rows[0]),
    permissions: {
      ...emptyMediaPermissions(),
      canLike: hasPermission(permissionKeys, 'media.react'),
      canComment: hasPermission(permissionKeys, 'media.comment'),
      canDelete,
    },
  }
}

async function listPicoMedia(client, picoId) {
  const { rows } = await client.query(
    `
      select
        id,
        pico_id,
        user_id,
        media_type,
        title,
        file_url,
        likes_count,
        comments_count,
        views_count,
        created_at
      from pico_media
      where pico_id = $1
      order by created_at desc
    `,
    [picoId],
  )

  return rows
}

async function listPicoEvents(client, picoId) {
  const { rows } = await client.query(
    `
      select
        pico_event.id,
        pico_event.pico_id,
        pico_event.created_by,
        pico_event.title,
        pico_event.description,
        pico_event.sport_id,
        pico_event.starts_at,
        pico_event.entry_fee_cents,
        pico_event.prize_pool_cents,
        pico_event.approval_status,
        pico_event.created_at,
        sport.id as sport_id,
        sport.slug as sport_slug,
        sport.name as sport_name
      from pico_event
      join sport on sport.id = pico_event.sport_id
      where pico_event.pico_id = $1
      order by pico_event.starts_at asc
    `,
    [picoId],
  )

  return rows.map(mapEventRow)
}

async function listPicoCampaigns(client, picoId) {
  const { rows } = await client.query(
    `
      select
        id,
        pico_id,
        created_by,
        title,
        purpose,
        goal_cents,
        amount_raised_cents,
        status,
        created_at
      from crowdfunding_campaign
      where pico_id = $1
      order by created_at desc
    `,
    [picoId],
  )

  return rows.map(mapCampaign)
}

async function buildPicoDetail(client, picoId, currentUserId = null) {
  const summary = await buildPicoSummary(client, picoId, currentUserId)
  if (!summary) return null

  const [mediaRows, eventRows, campaigns, admins, likedBy, permissions] = await Promise.all([
    listPicoMedia(client, picoId),
    listPicoEvents(client, picoId),
    listPicoCampaigns(client, picoId),
    listPicoAdmins(client, picoId, currentUserId),
    listPicoVoters(client, picoId, currentUserId),
    getPicoPermissionsForUser(client, picoId, currentUserId),
  ])

  const media = (
    await Promise.all(mediaRows.map((row) => buildMediaDetail(client, row, currentUserId)))
  ).filter(Boolean)

  const events = eventRows.filter((item) => {
    if (item.approvalStatus === 'approved') return true
    if (!currentUserId) return false
    if (item.createdBy === currentUserId) return true
    return permissions.canManageEvents || permissions.canApproveEvents
  })

  const topVideos = [...media]
    .filter((item) => item.mediaType === 'video')
    .sort((left, right) => right.likesCount - left.likesCount || right.viewsCount - left.viewsCount)
    .slice(0, 5)

  return {
    ...summary,
    media,
    events,
    campaigns,
    admins,
    likedBy,
    permissions,
    topVideos,
  }
}

async function buildFeedItem(client, row, currentUserId = null) {
  const [media, picoSummary] = await Promise.all([
    buildMediaDetail(client, row, currentUserId),
    buildPicoSummary(client, row.pico_id, currentUserId),
  ])

  if (!picoSummary) return null

  return {
    ...media,
    pico: toCompactPico(picoSummary),
  }
}

async function buildEventSummary(client, row, currentUserId = null) {
  const [picoSummary, host] = await Promise.all([
    buildPicoSummary(client, row.pico_id, currentUserId),
    getPublicUserViewById(client, row.created_by, currentUserId),
  ])

  if (!picoSummary) return null

  return {
    id: row.id,
    picoId: row.pico_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description || '',
    sportId: Number(row.sport_id),
    startsAt: new Date(row.starts_at).toISOString(),
    entryFeeCents: Number(row.entry_fee_cents || 0),
    prizePoolCents: Number(row.prize_pool_cents || 0),
    approvalStatus: row.approval_status || 'approved',
    createdAt: new Date(row.created_at).toISOString(),
    sport: mapSportRow(row),
    pico: toCompactPico(picoSummary),
    host,
    entryFeeLabel: money(row.entry_fee_cents),
    prizePoolLabel: money(row.prize_pool_cents),
  }
}

async function buildConversationSummary(client, conversationId, currentUserId) {
  const { rows } = await client.query(
    `
      select
        direct_conversation.id,
        direct_conversation.created_at,
        direct_conversation.updated_at,
        viewer_participant.last_read_at as viewer_last_read_at,
        coalesce(json_agg(direct_conversation_participant.user_id order by direct_conversation_participant.user_id), '[]'::json) as participant_ids,
        coalesce(message_count.total, 0)::int as messages_count,
        coalesce(unread_count.total, 0)::int as unread_count,
        last_message.id as last_message_id,
        last_message.sender_id as last_message_sender_id,
        last_message.text_content as last_message_text,
        last_message.created_at as last_message_created_at
      from direct_conversation
      join direct_conversation_participant
        on direct_conversation_participant.conversation_id = direct_conversation.id
      join direct_conversation_participant viewer_participant
        on viewer_participant.conversation_id = direct_conversation.id
       and viewer_participant.user_id = $2
      left join lateral (
        select count(*)::int as total
        from direct_message
        where direct_message.conversation_id = direct_conversation.id
      ) message_count on true
      left join lateral (
        select count(*)::int as total
        from direct_message
        where direct_message.conversation_id = direct_conversation.id
          and direct_message.sender_id <> $2
          and direct_message.created_at > viewer_participant.last_read_at
      ) unread_count on true
      left join lateral (
        select id, sender_id, text_content, created_at
        from direct_message
        where direct_message.conversation_id = direct_conversation.id
        order by created_at desc
        limit 1
      ) last_message on true
      where direct_conversation.id = $1
      group by
        direct_conversation.id,
        direct_conversation.created_at,
        direct_conversation.updated_at,
        viewer_participant.last_read_at,
        message_count.total,
        unread_count.total,
        last_message.id,
        last_message.sender_id,
        last_message.text_content,
        last_message.created_at
    `,
    [conversationId, currentUserId],
  )

  const row = rows[0]
  if (!row) return null

  const participantIds = Array.isArray(row.participant_ids) ? row.participant_ids : []
  const [participants, lastMessageSender] = await Promise.all([
    Promise.all(participantIds.map((participantId) => getPublicUserViewById(client, participantId, currentUserId))),
    row.last_message_sender_id
      ? getPublicUserViewById(client, row.last_message_sender_id, currentUserId)
      : Promise.resolve(null),
  ])

  const otherUserId = participantIds.find((participantId) => participantId !== currentUserId) || null
  const otherUser = otherUserId
    ? participants.find((participant) => participant?.id === otherUserId) || null
    : null

  return {
    id: row.id,
    participants: participants.filter(Boolean),
    otherUser,
    updatedAt: new Date(row.updated_at).toISOString(),
    lastReadAt: row.viewer_last_read_at ? new Date(row.viewer_last_read_at).toISOString() : null,
    messagesCount: Number(row.messages_count || 0),
    unreadCount: Number(row.unread_count || 0),
    lastMessage: row.last_message_id
      ? {
          id: row.last_message_id,
          text: row.last_message_text,
          createdAt: new Date(row.last_message_created_at).toISOString(),
          sender: lastMessageSender,
        }
      : null,
  }
}

async function buildConversationDetail(client, conversationId, currentUserId) {
  const summary = await buildConversationSummary(client, conversationId, currentUserId)
  if (!summary) return null

  const { rows } = await client.query(
    `
      select
        id,
        conversation_id,
        sender_id,
        text_content,
        created_at
      from direct_message
      where conversation_id = $1
      order by created_at asc
    `,
    [conversationId],
  )

  const uniqueSenderIds = [...new Set(rows.map((row) => row.sender_id))]
  const senders = new Map()

  await Promise.all(
    uniqueSenderIds.map(async (senderId) => {
      senders.set(senderId, await getPublicUserViewById(client, senderId, currentUserId))
    }),
  )

  return {
    ...summary,
    messages: rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      text: row.text_content,
      createdAt: new Date(row.created_at).toISOString(),
      sender: senders.get(row.sender_id) || null,
    })),
  }
}

async function ensureConversationMembership(client, conversationId, userId) {
  const { rows } = await client.query(
    `
      select 1
      from direct_conversation_participant
      where conversation_id = $1
        and user_id = $2
    `,
    [conversationId, userId],
  )

  return Boolean(rows[0])
}

async function markConversationRead(client, conversationId, userId) {
  await client.query(
    `
      update direct_conversation_participant
      set last_read_at = now()
      where conversation_id = $1
        and user_id = $2
    `,
    [conversationId, userId],
  )
}

async function generateUniquePicoSlug(client, name) {
  const baseSlug = slugify(name) || 'pico'
  let slug = baseSlug
  let index = 2

  while (true) {
    const { rows } = await client.query('select 1 from pico where slug = $1', [slug])
    if (!rows.length) return slug
    slug = `${baseSlug}-${index}`
    index += 1
  }
}

export async function createRepository() {
  await pingDatabase()

  return {
    async healthCheck() {
      await pingDatabase()
      return true
    },

    async getReferenceData() {
      return {
        sports: await getSports(),
        roles: await getRoles(),
      }
    },

    async getBootstrap(token) {
      const sports = await getSports()
      const currentUserId = token ? await getUserIdByToken({ query }, token) : null
      const currentUser = currentUserId
        ? await withTransaction(async (client) => {
            await ensureUserAccessState(client, currentUserId)
            return getUserViewById(client, currentUserId, currentUserId)
          })
        : null
      const { rows } = await query(
        `
          select id
          from pico
          order by created_at desc
          limit 6
        `,
      )

      const featuredPicos = (
        await Promise.all(rows.map((row) => buildPicoSummary({ query }, row.id, currentUser?.id || null)))
      ).filter(Boolean)

      return {
        appName: process.env.APP_NAME || 'PicoLiga',
        sports,
        roles: await getRoles(),
        currentUser,
        featuredPicos,
      }
    },

    async listPicos(filters = {}, currentUserId = null) {
      const params = []
      const whereClauses = []
      const permissionKeys = currentUserId ? await getUserPermissionKeys({ query }, currentUserId) : []

      if (filters.sportSlug && filters.sportSlug !== 'all') {
        params.push(filters.sportSlug)
        whereClauses.push(`sport.slug = $${params.length}`)
      }

      const north = safeNumber(filters.north)
      const south = safeNumber(filters.south)
      const east = safeNumber(filters.east)
      const west = safeNumber(filters.west)

      if ([north, south, east, west].every((value) => value !== null)) {
        params.push(south, north)
        const latitudeClause = `pico.latitude between $${params.length - 1} and $${params.length}`

        if (east >= west) {
          params.push(west, east)
          whereClauses.push(
            `${latitudeClause} and pico.longitude between $${params.length - 1} and $${params.length}`,
          )
        } else {
          params.push(west, east)
          whereClauses.push(
            `${latitudeClause} and (pico.longitude >= $${params.length - 1} or pico.longitude <= $${params.length})`,
          )
        }
      }

      const { rows } = await query(
        `
          select pico.id
          from pico
          join sport on sport.id = pico.primary_sport_id
          ${whereClauses.length ? `where ${whereClauses.join(' and ')}` : ''}
          order by pico.created_at desc
        `,
        params,
      )

      const items = (
        await Promise.all(rows.map((row) => buildPicoSummary({ query }, row.id, currentUserId)))
      ).filter(Boolean)

      return items
        .filter((item) => {
          if (item.approvalStatus === 'approved') return true
          if (!currentUserId) return false
          if (item.creator?.id === currentUserId) return true
          if (item.permissions?.isPicoAdmin) return true
          return canApprovePicos(permissionKeys)
        })
        .sort((left, right) => right.voteCount - left.voteCount || left.name.localeCompare(right.name))
    },

    async getPicoBySlug(slug, currentUserId = null) {
      const picoId = await getPicoIdBySlug({ query }, slug)
      if (!picoId) return null
      const visible = await canViewPico({ query }, picoId, currentUserId)
      return visible ? buildPicoDetail({ query }, picoId, currentUserId) : null
    },

    async listEvents(currentUserId = null) {
      const { rows } = await query(
        `
          select
            pico_event.id,
            pico_event.pico_id,
            pico_event.created_by,
            pico_event.title,
            pico_event.description,
            pico_event.sport_id,
            pico_event.starts_at,
            pico_event.entry_fee_cents,
            pico_event.prize_pool_cents,
            pico_event.approval_status,
            pico_event.created_at,
            sport.id as sport_id,
            sport.slug as sport_slug,
            sport.name as sport_name
          from pico_event
          join sport on sport.id = pico_event.sport_id
          order by pico_event.starts_at asc
        `,
      )

      const viewerLocation = await getUserLocationById({ query }, currentUserId)
      const permissionKeys = currentUserId ? await getUserPermissionKeys({ query }, currentUserId) : []
      const items = (
        await Promise.all(rows.map((row) => buildEventSummary({ query }, row, currentUserId)))
      ).filter(Boolean)

      return items
        .filter((item) => {
          if (item.approvalStatus === 'approved') return true
          if (!currentUserId) return false
          if (item.createdBy === currentUserId) return true
          if (item.pico?.permissions?.isPicoAdmin) return true
          return canApproveEvents(permissionKeys)
        })
        .map((item) => {
          const distanceKm = viewerLocation
            ? distanceBetweenLocations(viewerLocation, {
                latitude: item.pico.latitude,
                longitude: item.pico.longitude,
              })
            : null

          return {
            ...item,
            distanceKm,
            distanceLabel: distanceKm === null ? '' : `${distanceKm.toFixed(1)} km`,
          }
        })
        .sort((left, right) => {
          if (left.distanceKm === null && right.distanceKm === null) {
            return left.startsAt.localeCompare(right.startsAt)
          }
          if (left.distanceKm === null) return 1
          if (right.distanceKm === null) return -1
          if (left.distanceKm !== right.distanceKm) return left.distanceKm - right.distanceKm
          return left.startsAt.localeCompare(right.startsAt)
        })
    },

    async getEventById(eventId, currentUserId = null) {
      const visible = await canViewEvent({ query }, eventId, currentUserId)
      if (!visible) return null

      const row = await getEventRowById({ query }, eventId)
      if (!row) return null

      const viewerLocation = await getUserLocationById({ query }, currentUserId)
      const item = await buildEventSummary({ query }, row, currentUserId)
      if (!item) return null

      const distanceKm = viewerLocation
        ? distanceBetweenLocations(viewerLocation, {
            latitude: item.pico.latitude,
            longitude: item.pico.longitude,
          })
        : null

      return {
        ...item,
        distanceKm,
        distanceLabel: distanceKm === null ? '' : `${distanceKm.toFixed(1)} km`,
      }
    },

    async listFeed(filters = {}, currentUserId = null) {
      const params = []
      let whereClause = "where file_url <> ''"
      const limit = Math.min(Math.max(Number(filters.limit) || 10, 1), 20)
      const offset = Math.max(Number(filters.offset) || 0, 0)

      if (filters.authorId) {
        params.push(filters.authorId)
        whereClause += ` and user_id = $${params.length}`
      }

      params.push(limit, offset)

      const { rows } = await query(
        `
          select
            id,
            pico_id,
            user_id,
            media_type,
            title,
            file_url,
            likes_count,
            comments_count,
            views_count,
            created_at
          from pico_media
          ${whereClause}
          order by created_at desc
          limit $${params.length - 1}
          offset $${params.length}
        `,
        params,
      )

      const items = (
        await Promise.all(rows.map((row) => buildFeedItem({ query }, row, currentUserId)))
      ).filter(Boolean)

      return {
        items,
        hasMore: items.length === limit,
        nextOffset: offset + items.length,
      }
    },

    async listPeople(currentUserId) {
      const { rows } = await query(
        `
          select app_user.id
          from app_user
          join profile on profile.user_id = app_user.id
          where app_user.id <> $1
          order by profile.display_name asc
        `,
        [currentUserId],
      )

      const people = (
        await Promise.all(rows.map((row) => getPublicUserViewById({ query }, row.id, currentUserId)))
      ).filter(Boolean)

      return people.sort((left, right) => {
        if (left.isFollowing !== right.isFollowing) return left.isFollowing ? -1 : 1
        return left.displayName.localeCompare(right.displayName)
      })
    },

    async listModerationQueue(userId) {
      const permissionKeys = await getUserPermissionKeys({ query }, userId)
      const canReviewPicos = canApprovePicos(permissionKeys)
      const canReviewEvents = canApproveEvents(permissionKeys)

      if (!canReviewPicos && !canReviewEvents) {
        throw new Error('Seu perfil nao pode moderar picos ou eventos.')
      }

      const [pendingPicoRows, pendingEventRows] = await Promise.all([
        canReviewPicos
          ? query(
              `
                select id
                from pico
                where approval_status = 'pending'
                order by created_at asc
              `,
            )
          : Promise.resolve({ rows: [] }),
        canReviewEvents
          ? query(
              `
                select id
                from pico_event
                where approval_status = 'pending'
                order by created_at asc
              `,
            )
          : Promise.resolve({ rows: [] }),
      ])

      const [picos, events] = await Promise.all([
        Promise.all(pendingPicoRows.rows.map((row) => buildPicoDetail({ query }, row.id, userId))),
        Promise.all(
          pendingEventRows.rows.map(async (row) => {
            const eventRow = await getEventRowById({ query }, row.id)
            return eventRow ? buildEventSummary({ query }, eventRow, userId) : null
          }),
        ),
      ])

      return {
        picos: picos.filter(Boolean),
        events: events.filter(Boolean),
      }
    },

    async approvePico(userId, slug) {
      return withTransaction(async (client) => {
        const permissionKeys = await getUserPermissionKeys(client, userId)
        if (!canApprovePicos(permissionKeys)) {
          throw new Error('Voce nao pode aprovar picos.')
        }

        const picoId = await getPicoIdBySlug(client, slug)
        if (!picoId) {
          throw new Error('Pico nao encontrado.')
        }

        await client.query(
          `
            update pico
            set approval_status = 'approved',
                approved_by = $2,
                approved_at = now(),
                updated_at = now()
            where id = $1
          `,
          [picoId, userId],
        )

        return buildPicoDetail(client, picoId, userId)
      })
    },

    async rejectPico(userId, slug) {
      return withTransaction(async (client) => {
        const permissionKeys = await getUserPermissionKeys(client, userId)
        if (!canApprovePicos(permissionKeys)) {
          throw new Error('Voce nao pode rejeitar picos.')
        }

        const picoId = await getPicoIdBySlug(client, slug)
        if (!picoId) {
          throw new Error('Pico nao encontrado.')
        }

        await client.query(
          `
            update pico
            set approval_status = 'rejected',
                approved_by = $2,
                approved_at = now(),
                updated_at = now()
            where id = $1
          `,
          [picoId, userId],
        )

        return buildPicoDetail(client, picoId, userId)
      })
    },

    async approveEvent(userId, eventId) {
      return withTransaction(async (client) => {
        const permissionKeys = await getUserPermissionKeys(client, userId)
        if (!canApproveEvents(permissionKeys)) {
          throw new Error('Voce nao pode aprovar eventos.')
        }

        const row = await getEventRowById(client, eventId)
        if (!row) {
          throw new Error('Evento nao encontrado.')
        }

        await client.query(
          `
            update pico_event
            set approval_status = 'approved',
                approved_by = $2,
                approved_at = now(),
                updated_at = now()
            where id = $1
          `,
          [eventId, userId],
        )

        return buildEventSummary(client, { ...row, approval_status: 'approved' }, userId)
      })
    },

    async rejectEvent(userId, eventId) {
      return withTransaction(async (client) => {
        const permissionKeys = await getUserPermissionKeys(client, userId)
        if (!canApproveEvents(permissionKeys)) {
          throw new Error('Voce nao pode rejeitar eventos.')
        }

        const row = await getEventRowById(client, eventId)
        if (!row) {
          throw new Error('Evento nao encontrado.')
        }

        await client.query(
          `
            update pico_event
            set approval_status = 'rejected',
                approved_by = $2,
                approved_at = now(),
                updated_at = now()
            where id = $1
          `,
          [eventId, userId],
        )

        return buildEventSummary(client, { ...row, approval_status: 'rejected' }, userId)
      })
    },

    async assignRole(currentUserId, targetUserId, roleSlug) {
      return withTransaction(async (client) => {
        const permissionKeys = await getUserPermissionKeys(client, currentUserId)
        if (!hasPermission(permissionKeys, 'role.assign')) {
          throw new Error('Voce nao pode gerenciar roles de usuarios.')
        }

        const { rows: targetRows } = await client.query('select id from app_user where id = $1', [targetUserId])
        if (!targetRows.length) {
          throw new Error('Usuario nao encontrado.')
        }

        const roleId = await ensureRoleBySlug(client, roleSlug)
        await client.query(
          `
            insert into user_role (user_id, role_id, granted_by)
            values ($1, $2, $3)
            on conflict do nothing
          `,
          [targetUserId, roleId, currentUserId],
        )

        return getPublicUserViewById(client, targetUserId, currentUserId)
      })
    },

    async removeRole(currentUserId, targetUserId, roleSlug) {
      return withTransaction(async (client) => {
        const permissionKeys = await getUserPermissionKeys(client, currentUserId)
        if (!hasPermission(permissionKeys, 'role.assign')) {
          throw new Error('Voce nao pode gerenciar roles de usuarios.')
        }

        if (roleSlug === 'admin') {
          const { rows } = await client.query(
            `
              select count(*)::int as total
              from user_role
              join role on role.id = user_role.role_id
              where role.slug = 'admin'
            `,
          )

          const totalAdmins = Number(rows[0]?.total || 0)
          if (totalAdmins <= 1) {
            throw new Error('O sistema precisa manter pelo menos um administrador.')
          }
        }

        await client.query(
          `
            delete from user_role
            where user_id = $1
              and role_id = (
                select id
                from role
                where slug = $2
              )
          `,
          [targetUserId, roleSlug],
        )

        await ensureUserBaseRoles(client, targetUserId)
        return getPublicUserViewById(client, targetUserId, currentUserId)
      })
    },

    async listFollowingPeople(currentUserId) {
      const { rows } = await query(
        `
          select following_id as id
          from user_follow
          where follower_id = $1
          order by created_at desc
        `,
        [currentUserId],
      )

      const people = (
        await Promise.all(rows.map((row) => getPublicUserViewById({ query }, row.id, currentUserId)))
      ).filter(Boolean)

      return people.sort((left, right) => left.displayName.localeCompare(right.displayName))
    },

    async toggleFollow(currentUserId, targetUserId) {
      if (currentUserId === targetUserId) {
        throw new Error('Voce nao pode seguir o proprio perfil.')
      }

      return withTransaction(async (client) => {
        const { rows: targetRows } = await client.query('select id from app_user where id = $1', [targetUserId])
        if (!targetRows.length) {
          throw new Error('Perfil nao encontrado.')
        }

        const deleted = await client.query(
          `
            delete from user_follow
            where follower_id = $1
              and following_id = $2
            returning follower_id
          `,
          [currentUserId, targetUserId],
        )

        if (!deleted.rows.length) {
          await client.query(
            `
              insert into user_follow (follower_id, following_id)
              values ($1, $2)
            `,
            [currentUserId, targetUserId],
          )
        }

        return getPublicUserViewById(client, targetUserId, currentUserId)
      })
    },

    async listDirectConversations(userId) {
      const permissionKeys = await getUserPermissionKeys({ query }, userId)
      if (!hasPermission(permissionKeys, 'dm.use')) {
        throw new Error('Seu perfil nao pode usar mensagens diretas.')
      }

      const { rows } = await query(
        `
          select direct_conversation.id
          from direct_conversation
          join direct_conversation_participant
            on direct_conversation_participant.conversation_id = direct_conversation.id
          where direct_conversation_participant.user_id = $1
          order by direct_conversation.updated_at desc
        `,
        [userId],
      )

      const conversations = (
        await Promise.all(rows.map((row) => buildConversationSummary({ query }, row.id, userId)))
      ).filter(Boolean)

      return conversations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    },

    async getDirectConversation(userId, conversationId) {
      return withTransaction(async (client) => {
        const isMember = await ensureConversationMembership(client, conversationId, userId)
        if (!isMember) return null
        await markConversationRead(client, conversationId, userId)
        return buildConversationDetail(client, conversationId, userId)
      })
    },

    async openDirectConversation(userId, recipientUserId) {
      if (userId === recipientUserId) {
        throw new Error('Escolha outra pessoa para iniciar a conversa.')
      }

      return withTransaction(async (client) => {
        const permissionKeys = await getUserPermissionKeys(client, userId)
        if (!hasPermission(permissionKeys, 'dm.use')) {
          throw new Error('Seu perfil nao pode usar mensagens diretas.')
        }

        const { rows: recipientRows } = await client.query('select id from app_user where id = $1', [recipientUserId])
        if (!recipientRows.length) {
          throw new Error('Contato nao encontrado.')
        }

        const { rows: existingRows } = await client.query(
          `
            select direct_conversation.id
            from direct_conversation
            join direct_conversation_participant
              on direct_conversation_participant.conversation_id = direct_conversation.id
            group by direct_conversation.id
            having count(*) = 2
              and bool_or(direct_conversation_participant.user_id = $1)
              and bool_or(direct_conversation_participant.user_id = $2)
            limit 1
          `,
          [userId, recipientUserId],
        )

        const existingConversationId = existingRows[0]?.id
        if (existingConversationId) {
          await markConversationRead(client, existingConversationId, userId)
          return buildConversationDetail(client, existingConversationId, userId)
        }

        const { rows } = await client.query(
          `
            insert into direct_conversation default values
            returning id
          `,
        )

        const conversationId = rows[0].id
        await client.query(
          `
            insert into direct_conversation_participant (conversation_id, user_id)
            values ($1, $2), ($1, $3)
          `,
          [conversationId, userId, recipientUserId],
        )

        await markConversationRead(client, conversationId, userId)
        return buildConversationDetail(client, conversationId, userId)
      })
    },

    async sendDirectMessage(userId, conversationId, text) {
      const cleanText = normalizeString(text)
      if (!cleanText) {
        throw new Error('Escreva uma mensagem antes de enviar.')
      }

      return withTransaction(async (client) => {
        const permissionKeys = await getUserPermissionKeys(client, userId)
        if (!hasPermission(permissionKeys, 'dm.use')) {
          throw new Error('Seu perfil nao pode usar mensagens diretas.')
        }

        const isMember = await ensureConversationMembership(client, conversationId, userId)
        if (!isMember) {
          throw new Error('Conversa nao encontrada.')
        }

        const { rows } = await client.query(
          `
            insert into direct_message (conversation_id, sender_id, text_content)
            values ($1, $2, $3)
            returning created_at
          `,
          [conversationId, userId, cleanText],
        )

        await client.query(
          `
            update direct_conversation
            set updated_at = $2
            where id = $1
          `,
          [conversationId, rows[0].created_at],
        )

        await markConversationRead(client, conversationId, userId)
        return buildConversationDetail(client, conversationId, userId)
      })
    },

    async markDirectConversationRead(userId, conversationId) {
      return withTransaction(async (client) => {
        const isMember = await ensureConversationMembership(client, conversationId, userId)
        if (!isMember) {
          throw new Error('Conversa nao encontrada.')
        }

        await markConversationRead(client, conversationId, userId)
        return buildConversationDetail(client, conversationId, userId)
      })
    },

    async getUserByToken(token) {
      const userId = await getUserIdByToken({ query }, token)
      if (!userId) return null
      return withTransaction(async (client) => {
        await ensureUserAccessState(client, userId)
        return getUserViewById(client, userId, userId)
      })
    },

    async registerUser(payload) {
      const email = normalizeEmail(payload.email)
      const username = normalizeUsername(payload.username)
      const location = normalizeLocation(payload.location)
      const favoriteSportIds = normalizeFavoriteSportIds(payload.favoriteSportIds)

      return withTransaction(async (client) => {
        const { rows: emailRows } = await client.query('select id from app_user where email = $1', [email])
        if (emailRows.length) {
          throw new Error('Ja existe uma conta com esse email.')
        }

        const { rows: usernameRows } = await client.query('select id from app_user where username = $1', [username])
        if (usernameRows.length) {
          throw new Error('Esse usuario ja esta em uso.')
        }

        const validSportIds = await ensureSportIdsExist(client, favoriteSportIds)
        const { rows } = await client.query(
          `
            insert into app_user (
              email,
              username,
              password_hash,
              latitude,
              longitude,
              location_accuracy
            )
            values ($1, $2, $3, $4, $5, $6)
            returning id
          `,
          [
            email,
            username,
            await bcrypt.hash(payload.password, 10),
            location?.latitude ?? null,
            location?.longitude ?? null,
            location?.accuracy ?? null,
          ],
        )

        const userId = rows[0].id

        await ensureUserAccessState(client, userId)

        await client.query(
          `
            insert into profile (user_id, display_name, bio, avatar_url)
            values ($1, $2, '', $3)
          `,
          [userId, normalizeString(payload.displayName), normalizeString(payload.avatarUrl)],
        )

        for (const sportId of validSportIds) {
          await client.query(
            `
              insert into user_favorite_sport (user_id, sport_id)
              values ($1, $2)
            `,
            [userId, sportId],
          )
        }

        const token = `session_${randomUUID()}`
        await client.query(
          `
            insert into auth_session (token, user_id)
            values ($1, $2)
          `,
          [token, userId],
        )

        return {
          token,
          user: await getUserViewById(client, userId, userId),
        }
      })
    },

    async loginUser(payload) {
      const email = normalizeEmail(payload.email)
      const { rows } = await query(
        `
          select id, password_hash
          from app_user
          where email = $1
        `,
        [email],
      )

      const user = rows[0]
      if (!user?.password_hash) {
        throw new Error('Email ou senha invalidos.')
      }

      const matches = await bcrypt.compare(payload.password, user.password_hash)
      if (!matches) {
        throw new Error('Email ou senha invalidos.')
      }

      return withTransaction(async (client) => {
        await ensureUserAccessState(client, user.id)

        const token = `session_${randomUUID()}`
        await client.query(
          `
            insert into auth_session (token, user_id)
            values ($1, $2)
          `,
          [token, user.id],
        )

        return {
          token,
          user: await getUserViewById(client, user.id, user.id),
        }
      })
    },

    async updateUser(userId, payload) {
      const location = normalizeLocation(payload.location)

      await withTransaction(async (client) => {
        const validSportIds = await ensureSportIdsExist(client, payload.favoriteSportIds)

        const updatedUser = await client.query(
          `
            update app_user
            set
              latitude = $2,
              longitude = $3,
              location_accuracy = $4
            where id = $1
            returning id
          `,
          [
            userId,
            location?.latitude ?? null,
            location?.longitude ?? null,
            location?.accuracy ?? null,
          ],
        )

        if (!updatedUser.rows.length) {
          throw new Error('Usuario nao encontrado.')
        }

        await client.query(
          `
            update profile
            set
              display_name = $2,
              bio = $3,
              avatar_url = $4,
              updated_at = now()
            where user_id = $1
          `,
          [
            userId,
            normalizeString(payload.displayName),
            normalizeString(payload.bio),
            normalizeString(payload.avatarUrl),
          ],
        )

        await client.query('delete from user_favorite_sport where user_id = $1', [userId])

        for (const sportId of validSportIds) {
          await client.query(
            `
              insert into user_favorite_sport (user_id, sport_id)
              values ($1, $2)
            `,
            [userId, sportId],
          )
        }
      })

      return getUserViewById({ query }, userId, userId)
    },

    async createPico(userId, payload) {
      return withTransaction(async (client) => {
        const permissionKeys = await getUserPermissionKeys(client, userId)
        if (!hasPermission(permissionKeys, 'pico.create')) {
          throw new Error('Seu perfil nao pode criar novos picos.')
        }
        const approvalStatus = canApprovePicos(permissionKeys) ? 'approved' : 'pending'

        const primarySportId = Number(payload.primarySportId)
        const { rows: sportRows } = await client.query('select id from sport where id = $1', [primarySportId])

        if (!sportRows.length) {
          throw new Error('Selecione um esporte principal valido.')
        }

        const slug = await generateUniquePicoSlug(client, payload.name)
        const { rows } = await client.query(
          `
            insert into pico (
              created_by,
              primary_sport_id,
              name,
              slug,
              description,
              latitude,
              longitude,
              status_text,
              condition_label,
              cover_image_url,
              approval_status,
              approved_by,
              approved_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            returning id
          `,
          [
            userId,
            primarySportId,
            normalizeString(payload.name),
            slug,
            normalizeString(payload.description),
            Number(payload.latitude),
            Number(payload.longitude),
            normalizeString(payload.statusText) || 'Pico novo marcado agora',
            normalizeString(payload.conditionLabel) || 'novo',
            normalizeString(payload.coverImageUrl),
            approvalStatus,
            approvalStatus === 'approved' ? userId : null,
            approvalStatus === 'approved' ? new Date().toISOString() : null,
          ],
        )

        await client.query(
          `
            insert into pico_admin (pico_id, user_id, granted_by)
            values ($1, $2, $2)
            on conflict do nothing
          `,
          [rows[0].id, userId],
        )

        return buildPicoDetail(client, rows[0].id, userId)
      })
    },

    async updatePico(userId, slug, payload) {
      return withTransaction(async (client) => {
        const picoId = await getPicoIdBySlug(client, slug)
        if (!picoId) {
          throw new Error('Pico nao encontrado.')
        }

        await ensurePicoPermission(
          client,
          picoId,
          userId,
          'canEdit',
          'Voce nao pode editar esse pico.',
        )

        const primarySportId = Number(payload.primarySportId)
        const { rows: sportRows } = await client.query('select id from sport where id = $1', [primarySportId])
        if (!sportRows.length) {
          throw new Error('Selecione um esporte principal valido.')
        }

        await client.query(
          `
            update pico
            set
              primary_sport_id = $2,
              name = $3,
              description = $4,
              latitude = $5,
              longitude = $6,
              status_text = $7,
              condition_label = $8,
              cover_image_url = $9,
              updated_at = now()
            where id = $1
          `,
          [
            picoId,
            primarySportId,
            normalizeString(payload.name),
            normalizeString(payload.description),
            Number(payload.latitude),
            Number(payload.longitude),
            normalizeString(payload.statusText) || 'Pico atualizado',
            normalizeString(payload.conditionLabel) || 'ativo',
            normalizeString(payload.coverImageUrl),
          ],
        )

        return buildPicoDetail(client, picoId, userId)
      })
    },

    async deletePico(userId, slug) {
      return withTransaction(async (client) => {
        const picoId = await getPicoIdBySlug(client, slug)
        if (!picoId) {
          throw new Error('Pico nao encontrado.')
        }

        await ensurePicoPermission(
          client,
          picoId,
          userId,
          'canDelete',
          'Voce nao pode remover esse pico.',
        )

        await client.query('delete from pico where id = $1', [picoId])
        return { deleted: true, slug }
      })
    },

    async addPicoAdmin(userId, slug, targetUserId) {
      return withTransaction(async (client) => {
        const picoId = await getPicoIdBySlug(client, slug)
        if (!picoId) {
          throw new Error('Pico nao encontrado.')
        }

        await ensurePicoPermission(
          client,
          picoId,
          userId,
          'canManageAdmins',
          'Voce nao pode gerenciar administradores desse pico.',
        )

        const { rows: targetRows } = await client.query('select id from app_user where id = $1', [targetUserId])
        if (!targetRows.length) {
          throw new Error('Usuario nao encontrado.')
        }

        await client.query(
          `
            insert into pico_admin (pico_id, user_id, granted_by)
            values ($1, $2, $3)
            on conflict do nothing
          `,
          [picoId, targetUserId, userId],
        )

        return buildPicoDetail(client, picoId, userId)
      })
    },

    async removePicoAdmin(userId, slug, targetUserId) {
      return withTransaction(async (client) => {
        const picoId = await getPicoIdBySlug(client, slug)
        if (!picoId) {
          throw new Error('Pico nao encontrado.')
        }

        const permissions = await ensurePicoPermission(
          client,
          picoId,
          userId,
          'canManageAdmins',
          'Voce nao pode gerenciar administradores desse pico.',
        )

        if (permissions.isPicoAdmin && targetUserId === userId) {
          const { rows } = await client.query(
            `
              select count(*)::int as total
              from pico_admin
              where pico_id = $1
            `,
            [picoId],
          )

          if (Number(rows[0]?.total || 0) <= 1) {
            throw new Error('Esse pico precisa ter pelo menos um administrador.')
          }
        }

        await client.query(
          `
            delete from pico_admin
            where pico_id = $1
              and user_id = $2
          `,
          [picoId, targetUserId],
        )

        return buildPicoDetail(client, picoId, userId)
      })
    },

    async openCampaign(userId, slug, payload) {
      return withTransaction(async (client) => {
        const picoId = await getPicoIdBySlug(client, slug)
        if (!picoId) {
          throw new Error('Pico nao encontrado.')
        }

        await ensurePicoPermission(
          client,
          picoId,
          userId,
          'canManageEvents',
          'Voce nao pode abrir vaquinha nesse pico.',
        )

        const { rows: activeCampaignRows } = await client.query(
          `
            select id
            from crowdfunding_campaign
            where pico_id = $1
              and status = 'active'
            limit 1
          `,
          [picoId],
        )

        if (activeCampaignRows.length) {
          throw new Error('Esse pico ja tem uma vaquinha ativa.')
        }

        await client.query(
          `
            insert into crowdfunding_campaign (
              pico_id,
              created_by,
              title,
              purpose,
              goal_cents,
              amount_raised_cents,
              status
            )
            values ($1, $2, $3, $4, $5, 0, 'active')
          `,
          [
            picoId,
            userId,
            normalizeString(payload.title),
            normalizeString(payload.purpose),
            Number(payload.goalCents),
          ],
        )

        return buildPicoDetail(client, picoId, userId)
      })
    },

    async addContribution(userId, slug, payload) {
      return withTransaction(async (client) => {
        const picoId = await getPicoIdBySlug(client, slug)
        if (!picoId) {
          throw new Error('Pico nao encontrado.')
        }

        const { rows } = await client.query(
          `
            select id
            from crowdfunding_campaign
            where pico_id = $1
              and status = 'active'
            order by created_at desc
            limit 1
          `,
          [picoId],
        )

        const campaignId = rows[0]?.id
        if (!campaignId) {
          throw new Error('Esse pico nao tem vaquinha aberta no momento.')
        }

        await client.query(
          `
            update crowdfunding_campaign
            set amount_raised_cents = amount_raised_cents + $2
            where id = $1
          `,
          [campaignId, Number(payload.amountCents)],
        )

        await client.query(
          `
            insert into crowdfunding_contribution (campaign_id, user_id, amount_cents)
            values ($1, $2, $3)
          `,
          [campaignId, userId, Number(payload.amountCents)],
        )

        return buildPicoDetail(client, picoId, userId)
      })
    },

    async addEvent(userId, slug, payload) {
      return withTransaction(async (client) => {
        const picoId = await getPicoIdBySlug(client, slug)
        if (!picoId) {
          throw new Error('Pico nao encontrado.')
        }
        const picoPermissions = await getPicoPermissionsForUser(client, picoId, userId)
        const permissionKeys = await getUserPermissionKeys(client, userId)
        const canSubmitEvent = picoPermissions.canManageEvents || hasPermission(permissionKeys, 'event.submit')

        if (!canSubmitEvent) {
          throw new Error('Voce nao pode enviar eventos para esse pico.')
        }

        const approvalStatus = picoPermissions.canManageEvents || canApproveEvents(permissionKeys)
          ? 'approved'
          : 'pending'

        const sportId = Number(payload.sportId)
        const { rows: sportRows } = await client.query('select id from sport where id = $1', [sportId])
        if (!sportRows.length) {
          throw new Error('Selecione um esporte valido para o evento.')
        }

        const { rows } = await client.query(
          `
            insert into pico_event (
              pico_id,
              created_by,
              title,
              description,
              sport_id,
              starts_at,
              entry_fee_cents,
              prize_pool_cents,
              approval_status,
              approved_by,
              approved_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            returning id
          `,
          [
            picoId,
            userId,
            normalizeString(payload.title),
            normalizeString(payload.description),
            sportId,
            new Date(payload.startsAt).toISOString(),
            Number(payload.entryFeeCents || 0),
            Number(payload.prizePoolCents || 0),
            approvalStatus,
            approvalStatus === 'approved' ? userId : null,
            approvalStatus === 'approved' ? new Date().toISOString() : null,
          ],
        )

        const eventRow = await getEventRowById(client, rows[0].id)
        return buildEventSummary(client, eventRow, userId)
      })
    },

    async addMedia(userId, slug, payload) {
      const fileUrl = normalizeString(payload.fileUrl)
      if (!/^https:\/\//i.test(fileUrl)) {
        throw new Error('A midia enviada nao e valida.')
      }

      return withTransaction(async (client) => {
        const picoId = await getPicoIdBySlug(client, slug)
        if (!picoId) {
          throw new Error('Pico nao encontrado.')
        }

        const permissionKeys = await getUserPermissionKeys(client, userId)
        if (!hasPermission(permissionKeys, 'feed.post')) {
          throw new Error('Seu perfil nao pode publicar no feed.')
        }

        await client.query(
          `
            insert into pico_media (
              pico_id,
              user_id,
              media_type,
              title,
              file_url,
              likes_count,
              comments_count,
              views_count
            )
            values ($1, $2, $3, $4, $5, 0, 0, 0)
          `,
          [
            picoId,
            userId,
            payload.mediaType === 'video' ? 'video' : 'photo',
            normalizeString(payload.title),
            fileUrl,
          ],
        )

        return buildPicoDetail(client, picoId, userId)
      })
    },

    async toggleMediaLike(userId, mediaId) {
      return withTransaction(async (client) => {
        const mediaRow = await getMediaRowById(client, mediaId)
        if (!mediaRow) {
          throw new Error('Publicacao nao encontrada.')
        }

        const permissionKeys = await getUserPermissionKeys(client, userId)
        if (!hasPermission(permissionKeys, 'media.react')) {
          throw new Error('Seu perfil nao pode curtir publicacoes.')
        }

        const deleted = await client.query(
          `
            delete from pico_media_like
            where media_id = $1
              and user_id = $2
            returning media_id
          `,
          [mediaId, userId],
        )

        if (!deleted.rows.length) {
          await client.query(
            `
              insert into pico_media_like (media_id, user_id)
              values ($1, $2)
            `,
            [mediaId, userId],
          )
          await client.query(
            `
              update pico_media
              set likes_count = likes_count + 1,
                  updated_at = now()
              where id = $1
            `,
            [mediaId],
          )
        } else {
          await client.query(
            `
              update pico_media
              set likes_count = greatest(likes_count - 1, 0),
                  updated_at = now()
              where id = $1
            `,
            [mediaId],
          )
        }

        return buildMediaDetail(client, await getMediaRowById(client, mediaId), userId)
      })
    },

    async addMediaComment(userId, mediaId, text) {
      const cleanText = normalizeString(text)
      if (!cleanText) {
        throw new Error('Escreva um comentario antes de enviar.')
      }

      return withTransaction(async (client) => {
        const mediaRow = await getMediaRowById(client, mediaId)
        if (!mediaRow) {
          throw new Error('Publicacao nao encontrada.')
        }

        const permissionKeys = await getUserPermissionKeys(client, userId)
        if (!hasPermission(permissionKeys, 'media.comment')) {
          throw new Error('Seu perfil nao pode comentar publicacoes.')
        }

        await client.query(
          `
            insert into pico_media_comment (media_id, user_id, text_content)
            values ($1, $2, $3)
          `,
          [mediaId, userId, cleanText],
        )

        await client.query(
          `
            update pico_media
            set comments_count = comments_count + 1,
                updated_at = now()
            where id = $1
          `,
          [mediaId],
        )

        return buildMediaDetail(client, await getMediaRowById(client, mediaId), userId)
      })
    },

    async deleteMediaComment(userId, mediaId, commentId) {
      return withTransaction(async (client) => {
        const mediaRow = await getMediaRowById(client, mediaId)
        if (!mediaRow) {
          throw new Error('Publicacao nao encontrada.')
        }

        const { rows } = await client.query(
          `
            select id, user_id
            from pico_media_comment
            where id = $1
              and media_id = $2
          `,
          [commentId, mediaId],
        )

        const commentRow = rows[0]
        if (!commentRow) {
          throw new Error('Comentario nao encontrado.')
        }

        const picoPermissions = await getPicoPermissionsForUser(client, mediaRow.pico_id, userId)
        if (!picoPermissions.canModerateContent && commentRow.user_id !== userId) {
          throw new Error('Voce nao pode remover esse comentario.')
        }

        await client.query('delete from pico_media_comment where id = $1', [commentId])
        await client.query(
          `
            update pico_media
            set comments_count = greatest(comments_count - 1, 0),
                updated_at = now()
            where id = $1
          `,
          [mediaId],
        )

        return buildMediaDetail(client, await getMediaRowById(client, mediaId), userId)
      })
    },

    async deleteMedia(userId, mediaId) {
      return withTransaction(async (client) => {
        const mediaRow = await getMediaRowById(client, mediaId)
        if (!mediaRow) {
          throw new Error('Publicacao nao encontrada.')
        }

        const picoPermissions = await getPicoPermissionsForUser(client, mediaRow.pico_id, userId)
        if (!picoPermissions.canModerateContent && mediaRow.user_id !== userId) {
          throw new Error('Voce nao pode remover essa publicacao.')
        }

        await client.query('delete from pico_media where id = $1', [mediaId])

        return {
          deleted: true,
          mediaId,
          picoId: mediaRow.pico_id,
        }
      })
    },

    async toggleVote(userId, slug) {
      return withTransaction(async (client) => {
        const picoId = await getPicoIdBySlug(client, slug)
        if (!picoId) {
          throw new Error('Pico nao encontrado.')
        }

        const deleted = await client.query(
          `
            delete from pico_vote
            where pico_id = $1
              and user_id = $2
            returning pico_id
          `,
          [picoId, userId],
        )

        if (!deleted.rows.length) {
          await client.query(
            `
              insert into pico_vote (pico_id, user_id)
              values ($1, $2)
            `,
            [picoId, userId],
          )
        }

        return buildPicoDetail(client, picoId, userId)
      })
    },
  }
}

export function validateRegistrationPayload(payload) {
  if (
    !normalizeString(payload.displayName) ||
    !normalizeString(payload.username) ||
    !normalizeString(payload.email) ||
    !normalizeString(payload.password)
  ) {
    throw new Error('Preencha nome, usuario, email e senha.')
  }

  if (!normalizeLocation(payload.location)) {
    throw new Error('Ative sua localizacao exata para criar a conta.')
  }

  if (normalizeFavoriteSportIds(payload.favoriteSportIds).length === 0) {
    throw new Error('Selecione pelo menos um esporte favorito.')
  }
}

export function validateProfilePayload(payload) {
  if (!normalizeString(payload.displayName)) {
    throw new Error('Informe o nome exibido.')
  }

  if (!normalizeLocation(payload.location)) {
    throw new Error('Atualize sua localizacao exata.')
  }

  if (normalizeFavoriteSportIds(payload.favoriteSportIds).length === 0) {
    throw new Error('Selecione pelo menos um esporte favorito.')
  }
}

export function validatePicoPayload(payload) {
  if (!normalizeString(payload.name) || !normalizeString(payload.description)) {
    throw new Error('Preencha nome e descricao do pico.')
  }

  if (!safeNumber(payload.primarySportId)) {
    throw new Error('Selecione o esporte principal.')
  }

  if (safeNumber(payload.latitude) === null || safeNumber(payload.longitude) === null) {
    throw new Error('Use sua localizacao exata ou informe latitude e longitude validas.')
  }
}
