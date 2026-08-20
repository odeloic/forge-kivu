import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { AppError } from '../../lib/errors'
import { auth } from '../../middleware/auth'
import {
  createProjectSchema,
  projectIdParamSchema,
  projectItemParamSchema,
  setItemSchema,
  updateProjectSchema,
} from './projects.schemas'
import {
  create,
  getOwned,
  list,
  remove,
  removeItem,
  setItem,
  update,
} from './projects.service'

export const projectRoutes = new Hono()
  .use('*', auth)
  .post('/', zValidator('json', createProjectSchema), async (c) =>
    c.json(await create(c.get('user').id, c.req.valid('json')), 201),
  )
  .get('/', async (c) => c.json(await list(c.get('user').id)))
  .get('/:id', zValidator('param', projectIdParamSchema), async (c) => {
    const project = await getOwned(c.req.valid('param').id, c.get('user').id)
    if (!project) throw new AppError('NOT_FOUND', 'Project not found')
    return c.json(project)
  })
  .patch(
    '/:id',
    zValidator('param', projectIdParamSchema),
    zValidator('json', updateProjectSchema),
    async (c) =>
      c.json(
        await update(
          c.req.valid('param').id,
          c.get('user').id,
          c.req.valid('json'),
        ),
      ),
  )
  .delete('/:id', zValidator('param', projectIdParamSchema), async (c) => {
    await remove(c.req.valid('param').id, c.get('user').id)
    return c.body(null, 204)
  })
  .put(
    '/:id/items/:variantId',
    zValidator('param', projectItemParamSchema),
    zValidator('json', setItemSchema),
    async (c) => {
      const { id, variantId } = c.req.valid('param')
      return c.json(
        await setItem(
          id,
          c.get('user').id,
          variantId,
          c.req.valid('json').quantity,
        ),
      )
    },
  )
  .delete(
    '/:id/items/:variantId',
    zValidator('param', projectItemParamSchema),
    async (c) => {
      const { id, variantId } = c.req.valid('param')
      await removeItem(id, c.get('user').id, variantId)
      return c.body(null, 204)
    },
  )
