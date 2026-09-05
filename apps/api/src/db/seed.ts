import { PutObjectCommand } from '@aws-sdk/client-s3'
import { eq } from 'drizzle-orm'
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { z } from 'zod'

import {
  ATTRIBUTE_VALUE_TYPES,
  hexSchema,
  OPTION_VALUE_TYPE_VALUES,
  ROLES,
  type Role,
} from '@forge-kivu/types'

import { client, db } from '.'
import { env } from '../env'
import { logger } from '../lib/logger'
import { signup } from '../modules/auth/auth.service'
import { users } from '../modules/auth/auth.tables'
import { createProductSchema } from '../modules/catalogue/catalogue.schemas'
import {
  PRODUCT_STATUSES,
  productMedia,
  productOptions,
  productOptionValues,
  products,
  productSpecs,
  productVariants,
  variantOptionValues,
} from '../modules/catalogue/catalogue.tables'
import { ALLOWED_MIME_TYPES } from '../modules/media/media.schemas'
import { media, MEDIA_STATUSES } from '../modules/media/media.tables'
import { createSupplierSchema } from '../modules/suppliers/suppliers.schemas'
import { suppliers } from '../modules/suppliers/suppliers.tables'
import {
  createAttributeSchema,
  createCategorySchema,
  createSpaceSchema,
  createUnitSchema,
} from '../modules/taxonomy/taxonomy.schemas'
import {
  categories,
  spaces,
  specAttributes,
  units,
} from '../modules/taxonomy/taxonomy.tables'
import { s3 } from '../storage'

type SeedCategory = {
  name: string
  slug: string
  children?: SeedCategory[]
}

type SeedSupplier = {
  name: string
  slug: string
  description?: string | null
  visible: boolean
}

type SeedSpecAttribute = z.infer<typeof createAttributeSchema>

type SeedUnit = z.infer<typeof createUnitSchema>

type SeedSpace = z.infer<typeof createSpaceSchema>

type SeedProduct = z.infer<typeof seedProductSchema>

type SeededMedia = { id: string; key: string }

const PRODUCT_IMAGE_PREFIX = 'product-images'

const MIME_TYPES: Record<string, (typeof ALLOWED_MIME_TYPES)[number]> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
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

const seedSuppliersSchema = z
  .array(
    createSupplierSchema
      .pick({ name: true, slug: true, description: true })
      .extend({ visible: z.boolean() }),
  )
  .min(1)
  .superRefine((items, ctx) => {
    const slugs = new Set<string>()

    for (const item of items) {
      if (slugs.has(item.slug)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate supplier slug: ${item.slug}`,
        })
      }
      slugs.add(item.slug)
    }
  })

const seedUnitsSchema = z
  .array(createUnitSchema)
  .min(1)
  .superRefine((items, ctx) => {
    const slugs = new Set<string>()

    for (const item of items) {
      if (slugs.has(item.slug)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate unit slug: ${item.slug}`,
        })
      }
      slugs.add(item.slug)
    }
  })

const seedSpacesSchema = z
  .array(createSpaceSchema)
  .min(1)
  .superRefine((items, ctx) => {
    const slugs = new Set<string>()

    for (const item of items) {
      if (slugs.has(item.slug)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate space slug: ${item.slug}`,
        })
      }
      slugs.add(item.slug)
    }
  })

const seedSpecAttributesSchema = z
  .array(createAttributeSchema)
  .min(1)
  .superRefine((items, ctx) => {
    const slugs = new Set<string>()

    for (const item of items) {
      if (slugs.has(item.slug)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate spec attribute slug: ${item.slug}`,
        })
      }
      slugs.add(item.slug)
    }
  })

const seedProductSchema = createProductSchema
  .omit({ supplierId: true, categoryId: true })
  .extend({
    supplier: z.string().min(1),
    category: z.string().min(1),
    status: z.enum([
      PRODUCT_STATUSES.DRAFT,
      PRODUCT_STATUSES.PUBLISHED,
      PRODUCT_STATUSES.NOT_AVAILABLE,
    ]),
    media: z.array(z.string().min(1)).default([]),
    specs: z.record(z.string().min(1), z.string().min(1)).default({}),
    options: z
      .array(
        z
          .object({
            name: z.string().min(1),
            type: z
              .enum(OPTION_VALUE_TYPE_VALUES)
              .default(ATTRIBUTE_VALUE_TYPES.TEXT),
            values: z
              .array(
                z.union([
                  z
                    .string()
                    .min(1)
                    .transform((value) => ({ value, hex: undefined })),
                  z.object({
                    value: z.string().min(1),
                    hex: hexSchema.optional(),
                  }),
                ]),
              )
              .min(1),
          })
          .superRefine((option, ctx) => {
            const coloured = option.type === ATTRIBUTE_VALUE_TYPES.COLOR
            for (const row of option.values) {
              if (coloured ? row.hex === undefined : row.hex !== undefined) {
                ctx.addIssue({
                  code: 'custom',
                  message: `${option.name}/${row.value} does not match the ${option.type} option type`,
                })
              }
            }
          }),
      )
      .default([]),
    variants: z
      .array(
        z.object({
          sku: z.string().min(1),
          price: z.number().nonnegative(),
          unit: z.string().min(1).default('piece'),
          options: z.record(z.string().min(1), z.string().min(1)).default({}),
        }),
      )
      .min(1),
  })
  .superRefine((product, ctx) => {
    const declared = new Map(
      product.options.map((option) => [
        option.name,
        new Set(option.values.map((row) => row.value)),
      ]),
    )

    for (const variant of product.variants) {
      const chosen = Object.entries(variant.options)

      if (chosen.length !== declared.size) {
        ctx.addIssue({
          code: 'custom',
          message: `${product.slug}/${variant.sku} must choose every option`,
        })
      }

      for (const [name, value] of chosen) {
        if (!declared.get(name)?.has(value)) {
          ctx.addIssue({
            code: 'custom',
            message: `${product.slug}/${variant.sku} has unknown option ${name}: ${value}`,
          })
        }
      }
    }
  })

const seedProductsSchema = z
  .array(seedProductSchema)
  .min(1)
  .superRefine((items, ctx) => {
    const keys = new Set<string>()
    const skus = new Set<string>()

    for (const item of items) {
      const key = `${item.supplier}/${item.slug}`
      if (keys.has(key)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate product: ${key}` })
      }
      keys.add(key)

      for (const variant of item.variants) {
        if (skus.has(variant.sku)) {
          ctx.addIssue({
            code: 'custom',
            message: `Duplicate SKU: ${variant.sku}`,
          })
        }
        skus.add(variant.sku)
      }
    }
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

  const [row] = await db
    .update(users)
    .set({ role })
    .where(eq(users.email, normalized))
    .returning({ id: users.id })

  if (!row) throw new Error(`user upsert returned no row: ${normalized}`)

  return { id: row.id, email: normalized }
}

const loadSeedCategories = async (): Promise<SeedCategory[]> => {
  const source = await Bun.file(
    new URL('./seed-data/categories.yaml', import.meta.url),
  ).text()

  return seedCategoriesSchema.parse(parse(source))
}

const loadSeedSuppliers = async (): Promise<SeedSupplier[]> => {
  const source = await Bun.file(
    new URL('./seed-data/suppliers.yaml', import.meta.url),
  ).text()

  return seedSuppliersSchema.parse(parse(source))
}

const loadSeedUnits = async (): Promise<SeedUnit[]> => {
  const source = await Bun.file(
    new URL('./seed-data/units.yaml', import.meta.url),
  ).text()

  return seedUnitsSchema.parse(parse(source))
}

const loadSeedSpaces = async (): Promise<SeedSpace[]> => {
  const source = await Bun.file(
    new URL('./seed-data/spaces.yaml', import.meta.url),
  ).text()

  return seedSpacesSchema.parse(parse(source))
}

const loadSeedSpecAttributes = async (): Promise<SeedSpecAttribute[]> => {
  const source = await Bun.file(
    new URL('./seed-data/spec-attributes.yaml', import.meta.url),
  ).text()

  return seedSpecAttributesSchema.parse(parse(source))
}

const loadSeedProducts = async (): Promise<SeedProduct[]> => {
  const source = await Bun.file(
    new URL('./seed-data/products.yaml', import.meta.url),
  ).text()

  return seedProductsSchema.parse(parse(source))
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

const seedSuppliers = async (items: SeedSupplier[]): Promise<number> =>
  db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .insert(suppliers)
        .values({
          name: item.name,
          slug: item.slug,
          description: item.description ?? null,
          visible: item.visible,
        })
        .onConflictDoUpdate({
          target: suppliers.slug,
          set: {
            name: item.name,
            description: item.description ?? null,
            visible: item.visible,
          },
        })
    }

    return items.length
  })

const seedUnits = async (items: SeedUnit[]): Promise<number> =>
  db.transaction(async (tx) => {
    for (const [sortOrder, item] of items.entries()) {
      await tx
        .insert(units)
        .values({
          name: item.name,
          symbol: item.symbol,
          slug: item.slug,
          sortOrder: item.sortOrder ?? sortOrder,
        })
        .onConflictDoUpdate({
          target: units.slug,
          set: {
            name: item.name,
            symbol: item.symbol,
            sortOrder: item.sortOrder ?? sortOrder,
          },
        })
    }

    return items.length
  })

const seedSpaces = async (items: SeedSpace[]): Promise<number> =>
  db.transaction(async (tx) => {
    for (const [sortOrder, item] of items.entries()) {
      await tx
        .insert(spaces)
        .values({
          name: item.name,
          slug: item.slug,
          sortOrder: item.sortOrder ?? sortOrder,
        })
        .onConflictDoUpdate({
          target: spaces.slug,
          set: { name: item.name, sortOrder: item.sortOrder ?? sortOrder },
        })
    }

    return items.length
  })

const seedSpecAttributes = async (
  items: SeedSpecAttribute[],
): Promise<number> =>
  db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .insert(specAttributes)
        .values({
          name: item.name,
          slug: item.slug,
          unit: item.unit ?? null,
          type: item.type,
        })
        .onConflictDoUpdate({
          target: specAttributes.slug,
          set: { name: item.name, unit: item.unit ?? null, type: item.type },
        })
    }

    return items.length
  })

const seedProductImages = async (
  uploadedById: string,
): Promise<SeededMedia[]> => {
  const directory = fileURLToPath(
    new URL(`./seed-data/${PRODUCT_IMAGE_PREFIX}/`, import.meta.url),
  )

  const names = (await readdir(directory)).sort()
  const seeded: SeededMedia[] = []

  for (const name of names) {
    const extension = name.split('.').pop()?.toLowerCase() ?? ''
    const mimeType = MIME_TYPES[extension]

    if (!mimeType) continue

    const bytes = await Bun.file(`${directory}${name}`).bytes()
    const key = `${PRODUCT_IMAGE_PREFIX}/${name}`

    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: mimeType,
      }),
    )

    const [row] = await db
      .insert(media)
      .values({
        key,
        mimeType,
        sizeBytes: bytes.byteLength,
        status: MEDIA_STATUSES.READY,
        uploadedById,
      })
      .onConflictDoUpdate({
        target: media.key,
        set: {
          mimeType,
          sizeBytes: bytes.byteLength,
          status: MEDIA_STATUSES.READY,
          uploadedById,
        },
      })
      .returning({ id: media.id })

    if (!row) throw new Error(`media upsert returned no row: ${key}`)

    seeded.push({ id: row.id, key })
  }

  return seeded
}

const seedProducts = async (
  items: SeedProduct[],
  seededMedia: SeededMedia[],
): Promise<number> => {
  const supplierIds = new Map(
    (
      await db
        .select({ id: suppliers.id, slug: suppliers.slug })
        .from(suppliers)
    ).map((row) => [row.slug, row.id]),
  )
  const categoryIds = new Map(
    (
      await db
        .select({ id: categories.id, slug: categories.slug })
        .from(categories)
    ).map((row) => [row.slug, row.id]),
  )
  const attributeIds = new Map(
    (
      await db
        .select({ id: specAttributes.id, slug: specAttributes.slug })
        .from(specAttributes)
    ).map((row) => [row.slug, row.id]),
  )
  const unitIds = new Map(
    (await db.select({ id: units.id, slug: units.slug }).from(units)).map(
      (row) => [row.slug, row.id],
    ),
  )
  const mediaIds = new Map(seededMedia.map((row) => [row.key, row.id]))

  return db.transaction(async (tx) => {
    for (const item of items) {
      const supplierId = supplierIds.get(item.supplier)
      if (!supplierId) throw new Error(`unknown supplier: ${item.supplier}`)

      const categoryId = categoryIds.get(item.category)
      if (!categoryId) throw new Error(`unknown category: ${item.category}`)

      const [product] = await tx
        .insert(products)
        .values({
          supplierId,
          categoryId,
          name: item.name,
          slug: item.slug,
          description: item.description ?? null,
          status: item.status,
        })
        .onConflictDoUpdate({
          target: [products.supplierId, products.slug],
          set: {
            categoryId,
            name: item.name,
            description: item.description ?? null,
            status: item.status,
          },
        })
        .returning({ id: products.id })

      if (!product)
        throw new Error(`product upsert returned no row: ${item.slug}`)

      await tx
        .delete(productVariants)
        .where(eq(productVariants.productId, product.id))
      await tx
        .delete(productOptions)
        .where(eq(productOptions.productId, product.id))
      await tx
        .delete(productSpecs)
        .where(eq(productSpecs.productId, product.id))
      await tx
        .delete(productMedia)
        .where(eq(productMedia.productId, product.id))

      const optionValueIds = new Map<string, string>()

      for (const [index, option] of item.options.entries()) {
        const [row] = await tx
          .insert(productOptions)
          .values({
            productId: product.id,
            name: option.name,
            type: option.type,
            sortOrder: index,
          })
          .returning({ id: productOptions.id })

        if (!row)
          throw new Error(`option insert returned no row: ${option.name}`)

        const values = await tx
          .insert(productOptionValues)
          .values(
            option.values.map((entry, order) => ({
              optionId: row.id,
              value: entry.value,
              hex: entry.hex ?? null,
              sortOrder: order,
            })),
          )
          .returning({
            id: productOptionValues.id,
            value: productOptionValues.value,
          })

        for (const value of values) {
          optionValueIds.set(`${option.name}|${value.value}`, value.id)
        }
      }

      for (const [index, variant] of item.variants.entries()) {
        const unitId = unitIds.get(variant.unit)
        if (!unitId) {
          throw new Error(`unknown unit for ${variant.sku}: ${variant.unit}`)
        }

        const [row] = await tx
          .insert(productVariants)
          .values({
            productId: product.id,
            sku: variant.sku,
            price: variant.price,
            unitId,
            sortOrder: index,
          })
          .returning({ id: productVariants.id })

        if (!row)
          throw new Error(`variant insert returned no row: ${variant.sku}`)

        const chosen = Object.entries(variant.options).map(([name, value]) => {
          const valueId = optionValueIds.get(`${name}|${value}`)
          if (!valueId) {
            throw new Error(
              `unknown option for ${variant.sku}: ${name} ${value}`,
            )
          }
          return { variantId: row.id, optionValueId: valueId }
        })

        if (chosen.length > 0)
          await tx.insert(variantOptionValues).values(chosen)
      }

      const specs = Object.entries(item.specs).map(([slug, value]) => {
        const attributeId = attributeIds.get(slug)
        if (!attributeId) {
          throw new Error(`unknown spec attribute for ${item.slug}: ${slug}`)
        }
        return { productId: product.id, attributeId, value }
      })

      if (specs.length > 0) await tx.insert(productSpecs).values(specs)

      const images = item.media.map((key, index) => {
        const mediaId = mediaIds.get(key)
        if (!mediaId) {
          throw new Error(`unknown media for ${item.slug}: ${key}`)
        }
        return { productId: product.id, mediaId, sortOrder: index }
      })

      if (images.length > 0) await tx.insert(productMedia).values(images)
    }

    return items.length
  })
}

if (env.NODE_ENV === 'production') {
  logger.error('db:seed is not available in production')
  process.exit(1)
}

const seedEnv = seedEnvSchema.parse(process.env)
const categoryRoots = await loadSeedCategories()
const supplierProfiles = await loadSeedSuppliers()
const unitDefinitions = await loadSeedUnits()
const spaceDefinitions = await loadSeedSpaces()
const attributeDefinitions = await loadSeedSpecAttributes()
const productDefinitions = await loadSeedProducts()

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
const supplierCount = await seedSuppliers(supplierProfiles)
const unitCount = await seedUnits(unitDefinitions)
const spaceCount = await seedSpaces(spaceDefinitions)
const attributeCount = await seedSpecAttributes(attributeDefinitions)
const seededMedia = await seedProductImages(admin.id)
const productCount = await seedProducts(productDefinitions, seededMedia)

logger.info(
  {
    admin: admin.email,
    basic: basic.email,
    categoryCount,
    supplierCount,
    unitCount,
    spaceCount,
    attributeCount,
    mediaCount: seededMedia.length,
    productCount,
  },
  'seeded development data',
)

await client.end()
