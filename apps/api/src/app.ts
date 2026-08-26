import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { requestId, type RequestIdVariables } from 'hono/request-id'

import { makeErrorResponse } from '@forge-kivu/types'

import { AppError } from './lib/errors'
import { logger } from './lib/logger'
import { adminRoutes } from './modules/admin/admin.routes'
import { authRoutes } from './modules/auth/auth.routes'
import { boqRoutes } from './modules/boq/boq.routes'
import { catalogueRoutes } from './modules/catalogue/catalogue.routes'
import { mediaRoutes } from './modules/media/media.routes'
import { projectRoutes } from './modules/projects/projects.routes'
import { settingsRoutes } from './modules/settings/settings.routes'
import { supplierRoutes } from './modules/suppliers/suppliers.routes'
import { taxonomyRoutes } from './modules/taxonomy/taxonomy.routes'

export const app = new Hono<{ Variables: RequestIdVariables }>()
  .use(requestId())
  .use(cors())
  .use(csrf())
  .onError((error, c) => {
    const context = {
      requestId: c.get('requestId'),
      method: c.req.method,
      path: c.req.path,
    }
    if (error instanceof AppError) {
      const level = error.status >= 500 ? 'error' : 'warn'
      logger[level]({ ...context, status: error.status }, error.code)
      return c.json(
        makeErrorResponse(error.code, context.requestId),
        error.status,
      )
    }
    if (error instanceof HTTPException) {
      logger.warn({ ...context, status: error.status }, error.message)
      return error.getResponse()
    }
    logger.error({ ...context, err: error }, 'unhandled error')
    return c.json(makeErrorResponse('INTERNAL', context.requestId), 500)
  })
  .route('/auth', authRoutes)
  .route('/catalogue', catalogueRoutes)
  .route('/media', mediaRoutes)
  .route('/projects', projectRoutes)
  .route('/', boqRoutes)
  .route('/settings', settingsRoutes)
  .route('/suppliers', supplierRoutes)
  .route('/', taxonomyRoutes)
  .route('/admin', adminRoutes)

export type AppType = typeof app
