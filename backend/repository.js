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

  const creator = await getPublicUserViewById(client, row.created_by, currentUserId)
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
    sport,
    creator,
    mediaCount: Number(row.media_count || 0),
    upcomingEventsCount: Number(row.upcoming_events_count || 0),
    voteCount: Number(row.vote_count || 0),
    hasVoted: Boolean(row.has_voted),
    previewPhoto: row.preview_photo || '',
    coverImageUrl: row.cover_image_url || '',
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
        views_count,
        created_at
      from pico_media
      where pico_id = $1
      order by created_at desc
    `,
    [picoId],
  )

  return rows.map(mapMediaRow)
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

  const [media, events, campaigns] = await Promise.all([
    listPicoMedia(client, picoId),
    listPicoEvents(client, picoId),
    listPicoCampaigns(client, picoId),
  ])

  const topVideos = [...media]
    .filter((item) => item.mediaType === 'video')
    .sort((left, right) => right.likesCount - left.likesCount || right.viewsCount - left.viewsCount)
    .slice(0, 5)

  return {
    ...summary,
    media,
    events,
    campaigns,
    topVideos,
  }
}

async function buildFeedItem(client, row, currentUserId = null) {
  const [author, picoSummary] = await Promise.all([
    getPublicUserViewById(client, row.user_id, currentUserId),
    buildPicoSummary(client, row.pico_id, currentUserId),
  ])

  if (!picoSummary) return null

  return {
    id: row.id,
    mediaType: row.media_type,
    title: row.title,
    fileUrl: row.file_url,
    likesCount: Number(row.likes_count || 0),
    viewsCount: Number(row.views_count || 0),
    createdAt: new Date(row.created_at).toISOString(),
    author,
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
        coalesce(json_agg(direct_conversation_participant.user_id order by direct_conversation_participant.user_id), '[]'::json) as participant_ids,
        coalesce(message_count.total, 0)::int as messages_count,
        last_message.id as last_message_id,
        last_message.sender_id as last_message_sender_id,
        last_message.text_content as last_message_text,
        last_message.created_at as last_message_created_at
      from direct_conversation
      join direct_conversation_participant
        on direct_conversation_participant.conversation_id = direct_conversation.id
      left join lateral (
        select count(*)::int as total
        from direct_message
        where direct_message.conversation_id = direct_conversation.id
      ) message_count on true
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
        message_count.total,
        last_message.id,
        last_message.sender_id,
        last_message.text_content,
        last_message.created_at
    `,
    [conversationId],
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
    messagesCount: Number(row.messages_count || 0),
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
      }
    },

    async getBootstrap(token) {
      const sports = await getSports()
      const currentUserId = token ? await getUserIdByToken({ query }, token) : null
      const currentUser = currentUserId ? await getUserViewById({ query }, currentUserId, currentUserId) : null
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
        currentUser,
        featuredPicos,
      }
    },

    async listPicos(filters = {}, currentUserId = null) {
      const params = []
      let whereClause = ''

      if (filters.sportSlug && filters.sportSlug !== 'all') {
        params.push(filters.sportSlug)
        whereClause = `where sport.slug = $${params.length}`
      }

      const { rows } = await query(
        `
          select pico.id
          from pico
          join sport on sport.id = pico.primary_sport_id
          ${whereClause}
          order by pico.created_at desc
        `,
        params,
      )

      const items = (
        await Promise.all(rows.map((row) => buildPicoSummary({ query }, row.id, currentUserId)))
      ).filter(Boolean)

      return items.sort((left, right) => right.voteCount - left.voteCount || left.name.localeCompare(right.name))
    },

    async getPicoBySlug(slug, currentUserId = null) {
      const picoId = await getPicoIdBySlug({ query }, slug)
      return picoId ? buildPicoDetail({ query }, picoId, currentUserId) : null
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
            pico_event.created_at,
            sport.id as sport_id,
            sport.slug as sport_slug,
            sport.name as sport_name
          from pico_event
          join sport on sport.id = pico_event.sport_id
          order by pico_event.starts_at asc
        `,
      )

      const items = (
        await Promise.all(rows.map((row) => buildEventSummary({ query }, row, currentUserId)))
      ).filter(Boolean)

      return items.sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    },

    async listFeed(filters = {}, currentUserId = null) {
      const params = []
      let whereClause = "where file_url <> ''"

      if (filters.authorId) {
        params.push(filters.authorId)
        whereClause += ` and user_id = $${params.length}`
      }

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
            views_count,
            created_at
          from pico_media
          ${whereClause}
          order by created_at desc
        `,
        params,
      )

      const items = (
        await Promise.all(rows.map((row) => buildFeedItem({ query }, row, currentUserId)))
      ).filter(Boolean)

      return items
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
      const isMember = await ensureConversationMembership({ query }, conversationId, userId)
      if (!isMember) return null
      return buildConversationDetail({ query }, conversationId, userId)
    },

    async openDirectConversation(userId, recipientUserId) {
      if (userId === recipientUserId) {
        throw new Error('Escolha outra pessoa para iniciar a conversa.')
      }

      return withTransaction(async (client) => {
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

        return buildConversationDetail(client, conversationId, userId)
      })
    },

    async sendDirectMessage(userId, conversationId, text) {
      const cleanText = normalizeString(text)
      if (!cleanText) {
        throw new Error('Escreva uma mensagem antes de enviar.')
      }

      return withTransaction(async (client) => {
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

        return buildConversationDetail(client, conversationId, userId)
      })
    },

    async getUserByToken(token) {
      const userId = await getUserIdByToken({ query }, token)
      if (!userId) return null
      return getUserViewById({ query }, userId, userId)
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

      const token = `session_${randomUUID()}`
      await query(
        `
          insert into auth_session (token, user_id)
          values ($1, $2)
        `,
        [token, user.id],
      )

      return {
        token,
        user: await getUserViewById({ query }, user.id, user.id),
      }
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
              cover_image_url
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
          ],
        )

        return buildPicoDetail(client, rows[0].id, userId)
      })
    },

    async openCampaign(userId, slug, payload) {
      return withTransaction(async (client) => {
        const picoId = await getPicoIdBySlug(client, slug)
        if (!picoId) {
          throw new Error('Pico nao encontrado.')
        }

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

        const sportId = Number(payload.sportId)
        const { rows: sportRows } = await client.query('select id from sport where id = $1', [sportId])
        if (!sportRows.length) {
          throw new Error('Selecione um esporte valido para o evento.')
        }

        await client.query(
          `
            insert into pico_event (
              pico_id,
              created_by,
              title,
              description,
              sport_id,
              starts_at,
              entry_fee_cents,
              prize_pool_cents
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8)
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
          ],
        )

        return buildPicoDetail(client, picoId, userId)
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

        await client.query(
          `
            insert into pico_media (
              pico_id,
              user_id,
              media_type,
              title,
              file_url,
              likes_count,
              views_count
            )
            values ($1, $2, $3, $4, $5, 0, 0)
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
