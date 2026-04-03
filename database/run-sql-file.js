import { promises as fs } from 'node:fs'
import path from 'node:path'
import { closeDatabase, query } from '../backend/db.js'

export async function runSqlFile(filename) {
  const filePath = path.join(process.cwd(), 'database', filename)
  const sql = await fs.readFile(filePath, 'utf8')
  await query(sql)
}

export async function finalizeDatabaseScript() {
  await closeDatabase()
}
