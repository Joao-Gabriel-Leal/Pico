import { finalizeDatabaseScript, runSqlFile } from './run-sql-file.js'

try {
  await runSqlFile('schema.sql')
  console.log('Schema PostgreSQL aplicado com sucesso.')
} finally {
  await finalizeDatabaseScript()
}
