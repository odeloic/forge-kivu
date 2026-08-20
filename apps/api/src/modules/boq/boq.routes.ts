import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { AppError } from '../../lib/errors'
import { auth } from '../../middleware/auth'
import {
  boqIdParamSchema,
  boqProjectParamSchema,
  exportQuerySchema,
} from './boq.schemas'
import { buildExport, generate, getOwned, listForProject } from './boq.service'

export const boqRoutes = new Hono()
  .post(
    '/projects/:projectId/boqs',
    auth,
    zValidator('param', boqProjectParamSchema),
    async (c) =>
      c.json(
        await generate(c.req.valid('param').projectId, c.get('user').id),
        201,
      ),
  )
  .get(
    '/projects/:projectId/boqs',
    auth,
    zValidator('param', boqProjectParamSchema),
    async (c) =>
      c.json(
        await listForProject(c.req.valid('param').projectId, c.get('user').id),
      ),
  )
  .get('/boqs/:id', auth, zValidator('param', boqIdParamSchema), async (c) => {
    const boq = await getOwned(c.req.valid('param').id, c.get('user').id)
    if (!boq) throw new AppError('NOT_FOUND', 'BOQ not found')
    return c.json(boq)
  })
  .get(
    '/boqs/:id/export',
    auth,
    zValidator('param', boqIdParamSchema),
    zValidator('query', exportQuerySchema),
    async (c) => {
      const file = await buildExport(
        c.req.valid('param').id,
        c.get('user').id,
        c.req.valid('query').format,
      )
      c.header('content-type', file.contentType)
      c.header('content-disposition', `attachment; filename="${file.filename}"`)
      return c.body(file.buffer)
    },
  )
