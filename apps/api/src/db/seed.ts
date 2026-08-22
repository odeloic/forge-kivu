import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { ROLES, type Role } from '@forge-kivu/types'

import { client, db } from '.'
import { env } from '../env'
import { logger } from '../lib/logger'
import { signup } from '../modules/auth/auth.service'
import { users } from '../modules/auth/auth.tables'

const seedEnvSchema = z.object({
  SEED_ADMIN_EMAIL: z.email().default('admin@forge-kivu.test'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('forge-kivu-admin'),
  SEED_BASIC_EMAIL: z.email().default('basic@forge-kivu.test'),
  SEED_BASIC_PASSWORD: z.string().min(8).default('forge-kivu-basic'),
})

const seedUser = async (email: string, password: string, role: Role) => {
  const normalized = email.trim().toLowerCase()

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))

  if (!existing) await signup(normalized, password)

  await db.update(users).set({ role }).where(eq(users.email, normalized))

  return normalized
}

if (env.NODE_ENV === 'production') {
  logger.error('db:seed is not available in production')
  process.exit(1)
}

const seedEnv = seedEnvSchema.parse(process.env)

const admin = await seedUser(
  seedEnv.SEED_ADMIN_EMAIL,
  seedEnv.SEED_ADMIN_PASSWORD,
  ROLES.ADMIN,
)
const basic = await seedUser(
  seedEnv.SEED_BASIC_EMAIL,
  seedEnv.SEED_BASIC_PASSWORD,
  ROLES.BASIC,
)

logger.info({ admin, basic }, 'seeded users')

await client.end()
