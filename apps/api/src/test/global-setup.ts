import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import { testDatabaseUrl } from './database-url'

export default async function setup(): Promise<void> {
  const url = new URL(testDatabaseUrl())
  const database = url.pathname.slice(1)

  const adminUrl = new URL(url)
  adminUrl.pathname = '/postgres'

  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} })
  const existing =
    await admin`select 1 from pg_database where datname = ${database}`
  if (existing.length === 0) await admin.unsafe(`create database "${database}"`)
  await admin.end()

  const client = postgres(url.toString(), { max: 1, onnotice: () => {} })
  await migrate(drizzle(client), { migrationsFolder: './drizzle' })
  await client.end()
}
