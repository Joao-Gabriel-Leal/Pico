import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ quiet: true })

const { Pool } = pg

let poolInstance = null

function parseBoolean(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on', 'require'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off', 'disable'].includes(normalized)) return false
  return null
}

function resolveSsl(connectionString) {
  const explicit = parseBoolean(process.env.DATABASE_SSL)
  if (explicit !== null) {
    return explicit ? { rejectUnauthorized: false } : false
  }

  try {
    const url = new URL(connectionString)
    const sslMode = url.searchParams.get('sslmode')
    if (sslMode === 'disable') return false
    if (sslMode === 'require') return { rejectUnauthorized: false }

    if (['localhost', '127.0.0.1'].includes(url.hostname)) {
      return false
    }
  } catch {
    return false
  }

  return { rejectUnauthorized: false }
}

function getPool() {
  if (poolInstance) return poolInstance

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('Configure DATABASE_URL para usar o PostgreSQL.')
  }

  poolInstance = new Pool({
    connectionString,
    ssl: resolveSsl(connectionString),
    max: Number(process.env.DATABASE_POOL_SIZE || 10),
  })

  return poolInstance
}

export async function query(text, params = []) {
  return getPool().query(text, params)
}

export async function withTransaction(callback) {
  const client = await getPool().connect()

  try {
    await client.query('begin')
    const result = await callback(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function pingDatabase() {
  await query('select 1')
}

export async function closeDatabase() {
  if (!poolInstance) return
  await poolInstance.end()
  poolInstance = null
}
