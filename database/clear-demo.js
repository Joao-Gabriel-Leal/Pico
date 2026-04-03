import bcrypt from 'bcryptjs'
import { deleteCloudinaryAssetFromUrl } from '../backend/cloudinary.js'
import { closeDatabase, query, withTransaction } from '../backend/db.js'

const adminEmail = 'admin@admin.com'
const adminPassword = '123'
const testEmail = 'teste@teste.com'
const testPassword = '123'

async function collectUrls() {
  const { rows } = await query(
    `
      select file_url as url from pico_media where file_url <> ''
      union
      select cover_image_url as url from pico where cover_image_url <> ''
      union
      select avatar_url as url from profile where avatar_url <> ''
    `,
  )

  return rows.map((row) => row.url).filter(Boolean)
}

async function ensureBaseUsers(client) {
  const adminHash = await bcrypt.hash(adminPassword, 10)
  const testHash = await bcrypt.hash(testPassword, 10)

  const { rows: adminRows } = await client.query(
    `
      insert into app_user (email, username, password_hash, latitude, longitude, location_accuracy)
      values ($1, 'admin', $2, -23.550520, -46.633308, 20)
      on conflict (email) do update
      set password_hash = excluded.password_hash,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          location_accuracy = excluded.location_accuracy
      returning id
    `,
    [adminEmail, adminHash],
  )

  const { rows: testRows } = await client.query(
    `
      insert into app_user (email, username, password_hash, latitude, longitude, location_accuracy)
      values ($1, 'teste', $2, -23.561414, -46.656120, 25)
      on conflict (email) do update
      set password_hash = excluded.password_hash,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          location_accuracy = excluded.location_accuracy
      returning id
    `,
    [testEmail, testHash],
  )

  const adminId = adminRows[0].id
  const testId = testRows[0].id

  await client.query(
    `
      insert into profile (user_id, display_name, bio, avatar_url)
      values
        ($1, 'Admin Pico', '', ''),
        ($2, 'Teste Pico', '', '')
      on conflict (user_id) do update
      set display_name = excluded.display_name,
          bio = excluded.bio,
          avatar_url = excluded.avatar_url,
          updated_at = now()
    `,
    [adminId, testId],
  )

  const { rows: roleRows } = await client.query(`select id, slug from role where slug in ('admin', 'usuario')`)
  const adminRoleId = roleRows.find((item) => item.slug === 'admin')?.id
  const userRoleId = roleRows.find((item) => item.slug === 'usuario')?.id

  await client.query('delete from user_role where user_id in ($1, $2)', [adminId, testId])

  if (adminRoleId) {
    await client.query(
      `
        insert into user_role (user_id, role_id, granted_by)
        values ($1, $2, $1)
        on conflict do nothing
      `,
      [adminId, adminRoleId],
    )
  }

  if (userRoleId) {
    await client.query(
      `
        insert into user_role (user_id, role_id, granted_by)
        values ($1, $2, $1), ($3, $2, $1)
        on conflict do nothing
      `,
      [adminId, userRoleId, testId],
    )
  }

  await client.query('delete from user_favorite_sport where user_id in ($1, $2)', [adminId, testId])
  await client.query(
    `
      insert into user_favorite_sport (user_id, sport_id)
      values ($1, 1), ($1, 2), ($2, 1)
      on conflict do nothing
    `,
    [adminId, testId],
  )

  return { adminId, testId }
}

async function clearDatabase() {
  const urls = await collectUrls()

  await withTransaction(async (client) => {
    await client.query('delete from auth_session')
    await client.query('delete from app_notification')
    await client.query('delete from direct_message_reaction')
    await client.query('delete from direct_message')
    await client.query('delete from direct_conversation_participant')
    await client.query('delete from direct_conversation')
    await client.query('delete from crowdfunding_contribution')
    await client.query('delete from crowdfunding_campaign')
    await client.query('delete from pico_media_comment')
    await client.query('delete from pico_media_like')
    await client.query('delete from pico_media')
    await client.query('delete from pico_event')
    await client.query('delete from pico_visit')
    await client.query('delete from pico_follow')
    await client.query('delete from pico_vote')
    await client.query('delete from pico_admin')
    await client.query('delete from pico')
    await client.query('delete from user_follow')
    await client.query('delete from user_favorite_sport')
    await client.query('delete from user_role')
    await client.query('delete from profile')
    await client.query('delete from app_user')

    await ensureBaseUsers(client)
  })

  const deleteResults = await Promise.allSettled(urls.map((url) => deleteCloudinaryAssetFromUrl(url)))
  const removedAssets = deleteResults.filter((item) => item.status === 'fulfilled' && item.value).length

  console.log(
    JSON.stringify(
      {
        ok: true,
        admin: { email: adminEmail, password: adminPassword },
        test: { email: testEmail, password: testPassword },
        deletedCloudinaryReferences: urls.length,
        removedAssets,
      },
      null,
      2,
    ),
  )
}

try {
  await clearDatabase()
} finally {
  await closeDatabase()
}
