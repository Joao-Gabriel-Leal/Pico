import { finalizeDatabaseScript, runSqlFile } from './run-sql-file.js'

try {
  await runSqlFile('seed.sql')
  console.log('Seed de esportes aplicado com sucesso.')
} finally {
  await finalizeDatabaseScript()
}
