import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { AppError } from '../../lib/errors'
import { countBySupplier } from '../catalogue/catalogue.service'
import {
  createGalleryItemSchema,
  createSupplierSchema,
  galleryItemParamSchema,
  reorderGallerySchema,
  supplierIdParamSchema,
  updateGalleryItemSchema,
  updateSupplierSchema,
} from './suppliers.schemas'
import {
  addGalleryItem,
  create,
  getById,
  getBySlug,
  listAll,
  listVisible,
  remove,
  removeGalleryItem,
  reorderGallery,
  update,
  updateGalleryItem,
} from './suppliers.service'

export const supplierRoutes = new Hono()
  .get('/', async (c) => c.json(await listVisible()))
  .get('/:slug', async (c) => {
    const supplier = await getBySlug(c.req.param('slug'))
    if (!supplier) throw new AppError('NOT_FOUND')
    return c.json(supplier)
  })

export const adminSupplierRoutes = new Hono()
  .get('/', async (c) => {
    const [rows, counts] = await Promise.all([listAll(), countBySupplier()])

    return c.json(
      rows.map((row) => ({ ...row, productCount: counts.get(row.id) ?? 0 })),
    )
  })
  .post('/', zValidator('json', createSupplierSchema), async (c) =>
    c.json(await create(c.req.valid('json')), 201),
  )
  .get('/:id', zValidator('param', supplierIdParamSchema), async (c) => {
    const supplier = await getById(c.req.valid('param').id)
    if (!supplier) throw new AppError('NOT_FOUND')
    return c.json(supplier)
  })
  .patch(
    '/:id',
    zValidator('param', supplierIdParamSchema),
    zValidator('json', updateSupplierSchema),
    async (c) =>
      c.json(await update(c.req.valid('param').id, c.req.valid('json'))),
  )
  .delete('/:id', zValidator('param', supplierIdParamSchema), async (c) => {
    await remove(c.req.valid('param').id)
    return c.body(null, 204)
  })
  .post(
    '/:id/gallery',
    zValidator('param', supplierIdParamSchema),
    zValidator('json', createGalleryItemSchema),
    async (c) =>
      c.json(
        await addGalleryItem(c.req.valid('param').id, c.req.valid('json')),
        201,
      ),
  )
  .put(
    '/:id/gallery/order',
    zValidator('param', supplierIdParamSchema),
    zValidator('json', reorderGallerySchema),
    async (c) =>
      c.json(
        await reorderGallery(
          c.req.valid('param').id,
          c.req.valid('json').itemIds,
        ),
      ),
  )
  .patch(
    '/:id/gallery/:itemId',
    zValidator('param', galleryItemParamSchema),
    zValidator('json', updateGalleryItemSchema),
    async (c) => {
      const { id, itemId } = c.req.valid('param')
      return c.json(await updateGalleryItem(id, itemId, c.req.valid('json')))
    },
  )
  .delete(
    '/:id/gallery/:itemId',
    zValidator('param', galleryItemParamSchema),
    async (c) => {
      const { id, itemId } = c.req.valid('param')
      await removeGalleryItem(id, itemId)
      return c.body(null, 204)
    },
  )
