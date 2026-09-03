import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import {
  createAttributeSchema,
  createCategorySchema,
  createSpaceSchema,
  createUnitSchema,
  taxonomyIdParamSchema,
  updateAttributeSchema,
  updateCategorySchema,
  updateSpaceSchema,
  updateUnitSchema,
} from './taxonomy.schemas'
import {
  createAttribute,
  createCategory,
  createSpace,
  createUnit,
  getTree,
  listAttributes,
  listSpaces,
  listUnits,
  removeAttribute,
  removeCategory,
  removeSpace,
  removeUnit,
  updateAttribute,
  updateCategory,
  updateSpace,
  updateUnit,
} from './taxonomy.service'

export const taxonomyRoutes = new Hono()
  .get('/categories', async (c) => c.json(await getTree()))
  .get('/spec-attributes', async (c) => c.json(await listAttributes()))
  .get('/units', async (c) => c.json(await listUnits()))
  .get('/spaces', async (c) => c.json(await listSpaces()))

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
  .post('/units', zValidator('json', createUnitSchema), async (c) =>
    c.json(await createUnit(c.req.valid('json')), 201),
  )
  .patch(
    '/units/:id',
    zValidator('param', taxonomyIdParamSchema),
    zValidator('json', updateUnitSchema),
    async (c) =>
      c.json(await updateUnit(c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete(
    '/units/:id',
    zValidator('param', taxonomyIdParamSchema),
    async (c) => {
      await removeUnit(c.req.valid('param').id)
      return c.body(null, 204)
    },
  )
  .post('/spaces', zValidator('json', createSpaceSchema), async (c) =>
    c.json(await createSpace(c.req.valid('json')), 201),
  )
  .patch(
    '/spaces/:id',
    zValidator('param', taxonomyIdParamSchema),
    zValidator('json', updateSpaceSchema),
    async (c) =>
      c.json(await updateSpace(c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete(
    '/spaces/:id',
    zValidator('param', taxonomyIdParamSchema),
    async (c) => {
      await removeSpace(c.req.valid('param').id)
      return c.body(null, 204)
    },
  )
