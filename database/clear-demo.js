import { deleteCloudinaryAssetFromUrl } from '../backend/cloudinary.js'
import { closeDatabase, query, withTransaction } from '../backend/db.js'

async function collectUrls() {
  const { rows } = await query(
    `
      select file_url as url from pico_media where file_url <> ''
      union
      select cover_image_url as url from pico where cover_image_url <> ''
      union
      select avatar_url as url from profile where avatar_url <> '' and user_id <> (
        select id from app_user where email = 'admin@admin.com' limit 1
      )
    `,
  )

  return rows.map((row) => row.url).filter(Boolean)
}

async function clearDatabase() {
  const urls = await collectUrls()

  await withTransaction(async (client) => {
    const { rows } = await client.query("select id from app_user where email = 'admin@admin.com' limit 1")
    const adminId = rows[0]?.id || null

    await client.query('delete from auth_session')
    await client.query('delete from direct_message')
    await client.query('delete from direct_conversation_participant')
    await client.query('delete from direct_conversation')
    await client.query('delete from crowdfunding_contribution')
    await client.query('delete from crowdfunding_campaign')
    await client.query('delete from pico_media_comment')
    await client.query('delete from pico_media_like')
    await client.query('delete from pico_media')
    await client.query('delete from pico_event')
    await client.query('delete from pico_vote')
    await client.query('delete from pico_admin')
    await client.query('delete from pico')
    await client.query('delete from user_follow')

    if (adminId) {
      await client.query('delete from user_favorite_sport where user_id <> $1', [adminId])
      await client.query('delete from user_role where user_id <> $1', [adminId])
      await client.query('delete from profile where user_id <> $1', [adminId])
      await client.query('delete from app_user where id <> $1', [adminId])
      await client.query(
        `
          update profile
          set bio = '',
              avatar_url = ''
          where user_id = $1
        `,
        [adminId],
      )
    } else {
      await client.query('delete from user_favorite_sport')
      await client.query('delete from user_role')
      await client.query('delete from profile')
      await client.query('delete from app_user')
    }
  })

  const deleteResults = await Promise.allSettled(urls.map((url) => deleteCloudinaryAssetFromUrl(url)))
  const removedAssets = deleteResults.filter((item) => item.status === 'fulfilled' && item.value).length

  console.log(
    JSON.stringify(
      {
        ok: true,
        preservedAdmin: 'admin@admin.com',
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
