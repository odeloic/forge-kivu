import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { AppError } from '../../lib/errors'
import { auth } from '../../middleware/auth'
import { boqSummaries } from '../boq/boq.service'
import {
  createProjectSchema,
  createProjectSpaceSchema,
  listQuerySchema,
  projectIdParamSchema,
  projectItemParamSchema,
  projectPhaseParamSchema,
  projectSpaceParamSchema,
  removeItemQuerySchema,
  setItemSchema,
  setPhaseSchema,
  updateProjectSchema,
  updateProjectSpaceSchema,
} from './projects.schemas'
import {
  clearPhaseCompletion,
  create,
  createSpace,
  getOwned,
  list,
  remove,
  removeItem,
  removeSpace,
  setItem,
  setPhaseCompletion,
  update,
  updateSpace,
} from './projects.service'

export const projectRoutes = new Hono()
  .use('*', auth)
  .post('/', zValidator('json', createProjectSchema), async (c) =>
    c.json(await create(c.get('user').id, c.req.valid('json')), 201),
  )
  .get('/', zValidator('query', listQuerySchema), async (c) => {
    const rows = await list(c.get('user').id, c.req.valid('query'))
    const summaries = await boqSummaries(rows.map((row) => row.id))

    return c.json(
      rows.map((row) => ({
        ...row,
        latestBoq: summaries.get(row.id) ?? null,
      })),
    )
  })
  .get('/:id', zValidator('param', projectIdParamSchema), async (c) => {
    const project = await getOwned(c.req.valid('param').id, c.get('user').id)
    if (!project) throw new AppError('NOT_FOUND')
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
        await setItem(id, c.get('user').id, variantId, c.req.valid('json')),
      )
    },
  )
  .delete(
    '/:id/items/:variantId',
    zValidator('param', projectItemParamSchema),
    zValidator('query', removeItemQuerySchema),
    async (c) => {
      const { id, variantId } = c.req.valid('param')
      await removeItem(
        id,
        c.get('user').id,
        variantId,
        c.req.valid('query').spaceId ?? null,
      )
      return c.body(null, 204)
    },
  )
  .post(
    '/:id/spaces',
    zValidator('param', projectIdParamSchema),
    zValidator('json', createProjectSpaceSchema),
    async (c) =>
      c.json(
        await createSpace(
          c.req.valid('param').id,
          c.get('user').id,
          c.req.valid('json'),
        ),
        201,
      ),
  )
  .patch(
    '/:id/spaces/:spaceId',
    zValidator('param', projectSpaceParamSchema),
    zValidator('json', updateProjectSpaceSchema),
    async (c) => {
      const { id, spaceId } = c.req.valid('param')
      return c.json(
        await updateSpace(id, c.get('user').id, spaceId, c.req.valid('json')),
      )
    },
  )
  .delete(
    '/:id/spaces/:spaceId',
    zValidator('param', projectSpaceParamSchema),
    async (c) => {
      const { id, spaceId } = c.req.valid('param')
      await removeSpace(id, c.get('user').id, spaceId)
      return c.body(null, 204)
    },
  )
  .put(
    '/:id/phases/:phase',
    zValidator('param', projectPhaseParamSchema),
    zValidator('json', setPhaseSchema),
    async (c) => {
      const { id, phase } = c.req.valid('param')
      return c.json(
        await setPhaseCompletion(
          id,
          c.get('user').id,
          phase,
          c.req.valid('json').completedOn,
        ),
      )
    },
  )
  .delete(
    '/:id/phases/:phase',
    zValidator('param', projectPhaseParamSchema),
    async (c) => {
      const { id, phase } = c.req.valid('param')
      await clearPhaseCompletion(id, c.get('user').id, phase)
      return c.body(null, 204)
    },
  )
