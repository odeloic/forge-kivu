import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import {
  createAttributeSchema,
  createCategorySchema,
  taxonomyIdParamSchema,
  updateAttributeSchema,
  updateCategorySchema,
} from './taxonomy.schemas'
import {
  createAttribute,
  createCategory,
  getTree,
  listAttributes,
  removeAttribute,
  removeCategory,
  updateAttribute,
  updateCategory,
} from './taxonomy.service'

export const taxonomyRoutes = new Hono()
  .get('/categories', async (c) => c.json(await getTree()))
  .get('/spec-attributes', async (c) => c.json(await listAttributes()))

export const adminTaxonomyRoutes = new Hono()
  .post('/categories', zValidator('json', createCategorySchema), async (c) =>
    c.json(await createCategory(c.req.valid('json')), 201),
  )
  .patch(
    '/categories/:id',
    zValidator('param', taxonomyIdParamSchema),
    zValidator('json', updateCategorySchema),
    async (c) =>
      c.json(
        await updateCategory(c.req.valid('param').id, c.req.valid('json')),
      ),
  )
  .delete(
    '/categories/:id',
    zValidator('param', taxonomyIdParamSchema),
    async (c) => {
      await removeCategory(c.req.valid('param').id)
      return c.body(null, 204)
    },
  )
  .post(
    '/spec-attributes',
    zValidator('json', createAttributeSchema),
    async (c) => c.json(await createAttribute(c.req.valid('json')), 201),
  )
  .patch(
    '/spec-attributes/:id',
    zValidator('param', taxonomyIdParamSchema),
    zValidator('json', updateAttributeSchema),
    async (c) =>
      c.json(
        await updateAttribute(c.req.valid('param').id, c.req.valid('json')),
      ),
  )
  .delete(
    '/spec-attributes/:id',
    zValidator('param', taxonomyIdParamSchema),
    async (c) => {
      await removeAttribute(c.req.valid('param').id)
      return c.body(null, 204)
    },
  )
