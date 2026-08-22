import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { AppError } from '../../lib/errors'
import {
  adminListQuerySchema,
  createProductSchema,
  productIdParamSchema,
  publicListQuerySchema,
  publicProductParamSchema,
  setMediaSchema,
  setOptionsSchema,
  setSpecsSchema,
  setVariantsSchema,
  updateProductSchema,
} from './catalogue.schemas'
import {
  createProduct,
  getForAdmin,
  getPublished,
  listForAdmin,
  listPublished,
  publish,
  removeProduct,
  setMedia,
  setOptions,
  setSpecs,
  setVariants,
  unpublish,
  updateProduct,
} from './catalogue.service'

export const catalogueRoutes = new Hono()
  .get('/products', zValidator('query', publicListQuerySchema), async (c) =>
    c.json(await listPublished(c.req.valid('query'))),
  )
  .get(
    '/products/:supplierSlug/:productSlug',
    zValidator('param', publicProductParamSchema),
    async (c) => {
      const { supplierSlug, productSlug } = c.req.valid('param')
      const product = await getPublished(supplierSlug, productSlug)
      if (!product) throw new AppError('NOT_FOUND')
      return c.json(product)
    },
  )

export const adminCatalogueRoutes = new Hono()
  .get('/', zValidator('query', adminListQuerySchema), async (c) =>
    c.json(await listForAdmin(c.req.valid('query'))),
  )
  .post('/', zValidator('json', createProductSchema), async (c) =>
    c.json(await createProduct(c.req.valid('json')), 201),
  )
  .get('/:id', zValidator('param', productIdParamSchema), async (c) =>
    c.json(await getForAdmin(c.req.valid('param').id)),
  )
  .patch(
    '/:id',
    zValidator('param', productIdParamSchema),
    zValidator('json', updateProductSchema),
    async (c) =>
      c.json(await updateProduct(c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete('/:id', zValidator('param', productIdParamSchema), async (c) => {
    await removeProduct(c.req.valid('param').id)
    return c.body(null, 204)
  })
  .post('/:id/publish', zValidator('param', productIdParamSchema), async (c) =>
    c.json(await publish(c.req.valid('param').id)),
  )
  .post(
    '/:id/unpublish',
    zValidator('param', productIdParamSchema),
    async (c) => c.json(await unpublish(c.req.valid('param').id)),
  )
  .put(
    '/:id/options',
    zValidator('param', productIdParamSchema),
    zValidator('json', setOptionsSchema),
    async (c) =>
      c.json(await setOptions(c.req.valid('param').id, c.req.valid('json'))),
  )
  .put(
    '/:id/variants',
    zValidator('param', productIdParamSchema),
    zValidator('json', setVariantsSchema),
    async (c) =>
      c.json(await setVariants(c.req.valid('param').id, c.req.valid('json'))),
  )
  .put(
    '/:id/specs',
    zValidator('param', productIdParamSchema),
    zValidator('json', setSpecsSchema),
    async (c) =>
      c.json(await setSpecs(c.req.valid('param').id, c.req.valid('json'))),
  )
  .put(
    '/:id/media',
    zValidator('param', productIdParamSchema),
    zValidator('json', setMediaSchema),
    async (c) =>
      c.json(await setMedia(c.req.valid('param').id, c.req.valid('json'))),
  )
