import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { auth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import { ROLES } from '../auth/auth.service'
import { createUploadSchema } from './media.schemas'
import { confirmUpload, createUpload, remove } from './media.service'

export const mediaRoutes = new Hono()
  .post('/', auth, zValidator('json', createUploadSchema), async (c) => {
    const result = await createUpload(c.get('user').id, c.req.valid('json'))
    return c.json(result, 201)
  })
  .post('/:id/confirm', auth, async (c) => {
    const record = await confirmUpload(c.req.param('id'), c.get('user').id)
    return c.json(record, 200)
  })
  .delete('/:id', auth, requireRole(ROLES.ADMIN), async (c) => {
    await remove(c.req.param('id'))
    return c.body(null, 204)
  })
