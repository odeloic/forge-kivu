import { createMiddleware } from 'hono/factory'

import { AppError } from '../lib/errors'
import type { AuthEnv } from './auth'
import type { Role } from '../modules/auth/auth.service'

export const requireRole = (role: Role) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    if (c.get('user').role !== role) {
      throw new AppError('FORBIDDEN', 'Forbidden')
    }
    await next()
  })
