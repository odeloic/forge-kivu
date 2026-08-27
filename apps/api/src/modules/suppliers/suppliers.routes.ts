import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { AppError } from '../../lib/errors'
import { countBySupplier } from '../catalogue/catalogue.service'
import {
  createSupplierSchema,
  supplierIdParamSchema,
  updateSupplierSchema,
} from './suppliers.schemas'
import {
  create,
  getBySlug,
  listAll,
  listVisible,
  remove,
  update,
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
