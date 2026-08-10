import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { requestId, type RequestIdVariables } from 'hono/request-id'

import { createTodoSchema, makeErrorResponse } from '@forge-kivu/types'

import { AppError } from './lib/errors'
import { logger } from './lib/logger'
import { auth } from './middleware/auth'
import { requireRole } from './middleware/require-role'
import { authRoutes } from './modules/auth/auth.routes'
import { ROLES } from './modules/auth/auth.service'
import {
  adminCatalogueRoutes,
  catalogueRoutes,
} from './modules/catalogue/catalogue.routes'
import { adminMediaRoutes, mediaRoutes } from './modules/media/media.routes'
import {
  adminSupplierRoutes,
  supplierRoutes,
} from './modules/suppliers/suppliers.routes'
import {
  adminTaxonomyRoutes,
  taxonomyRoutes,
} from './modules/taxonomy/taxonomy.routes'
import { todos } from './todos'

const adminRoutes = new Hono()
  .use('*', auth, requireRole(ROLES.ADMIN))
  .route('/media', adminMediaRoutes)
  .route('/products', adminCatalogueRoutes)
  .route('/suppliers', adminSupplierRoutes)
  .route('/', adminTaxonomyRoutes)

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
      logger[level](
        { ...context, code: error.code, status: error.status },
        error.message,
      )
      return c.json(
        makeErrorResponse(error.code, error.message, context.requestId),
        error.status,
      )
    }
    if (error instanceof HTTPException) {
      logger.warn({ ...context, status: error.status }, error.message)
      return error.getResponse()
    }
    logger.error({ ...context, err: error }, 'unhandled error')
    return c.json(
      makeErrorResponse('INTERNAL', 'Internal server error', context.requestId),
      500,
    )
  })
  .route('/auth', authRoutes)
  .route('/catalogue', catalogueRoutes)
  .route('/media', mediaRoutes)
  .route('/suppliers', supplierRoutes)
  .route('/', taxonomyRoutes)
  .route('/admin', adminRoutes)
  .get('/todos', (c) => c.json(todos.list()))
  .post('/todos', zValidator('json', createTodoSchema), (c) =>
    c.json(todos.create(c.req.valid('json')), 201),
  )

export type AppType = typeof app
