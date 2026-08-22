import { eq } from 'drizzle-orm'
import { parse } from 'yaml'
import { z } from 'zod'

import { ROLES, type Role } from '@forge-kivu/types'

import { client, db } from '.'
import { env } from '../env'
import { logger } from '../lib/logger'
import { signup } from '../modules/auth/auth.service'
import { users } from '../modules/auth/auth.tables'
import { createCategorySchema } from '../modules/taxonomy/taxonomy.schemas'
import { categories } from '../modules/taxonomy/taxonomy.tables'

type SeedCategory = {
  name: string
  slug: string
  children?: SeedCategory[]
}

const seedCategoryFieldsSchema = createCategorySchema.pick({
  name: true,
  slug: true,
})

const seedCategorySchema: z.ZodType<SeedCategory> = z.lazy(() =>
  seedCategoryFieldsSchema.extend({
    children: z.array(seedCategorySchema).optional(),
  }),
)

const seedCategoriesSchema = z
  .array(seedCategorySchema)
  .min(1)
  .superRefine((roots, ctx) => {
    const slugs = new Set<string>()

    const visit = (nodes: SeedCategory[]): void => {
      for (const node of nodes) {
        if (slugs.has(node.slug)) {
          ctx.addIssue({
            code: 'custom',
            message: `Duplicate category slug: ${node.slug}`,
          })
        }
        slugs.add(node.slug)
        visit(node.children ?? [])
      }
    }

    visit(roots)
  })

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

const loadSeedCategories = async (): Promise<SeedCategory[]> => {
  const source = await Bun.file(
    new URL('./seed-data/categories.yaml', import.meta.url),
  ).text()

  return seedCategoriesSchema.parse(parse(source))
}

const seedCategories = async (roots: SeedCategory[]): Promise<number> =>
  db.transaction(async (tx) => {
    let seeded = 0

    const upsertNodes = async (
      nodes: SeedCategory[],
      parentId: string | null,
    ): Promise<void> => {
      for (const [sortOrder, node] of nodes.entries()) {
        const [category] = await tx
          .insert(categories)
          .values({
            name: node.name,
            slug: node.slug,
            parentId,
            sortOrder,
          })
          .onConflictDoUpdate({
            target: categories.slug,
            set: { name: node.name, parentId, sortOrder },
          })
          .returning({ id: categories.id })

        if (!category) {
          throw new Error(`category upsert returned no row: ${node.slug}`)
        }

        seeded += 1
        await upsertNodes(node.children ?? [], category.id)
      }
    }

    await upsertNodes(roots, null)
    return seeded
  })

if (env.NODE_ENV === 'production') {
  logger.error('db:seed is not available in production')
  process.exit(1)
}

const seedEnv = seedEnvSchema.parse(process.env)
const categoryRoots = await loadSeedCategories()

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
const categoryCount = await seedCategories(categoryRoots)

logger.info({ admin, basic, categoryCount }, 'seeded development data')

await client.end()
