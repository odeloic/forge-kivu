import { Hono } from 'hono'

import { ROLES } from '@forge-kivu/types'

import { adminAuth } from '../../middleware/admin-auth'
import { requireRole } from '../../middleware/require-role'
import { adminCatalogueRoutes } from '../catalogue/catalogue.routes'
import { adminMediaRoutes } from '../media/media.routes'
import { adminSettingsRoutes } from '../settings/settings.routes'
import { adminSupplierRoutes } from '../suppliers/suppliers.routes'
import { adminTaxonomyRoutes } from '../taxonomy/taxonomy.routes'
import { adminAuthRoutes } from './admin-auth.routes'

const adminDomainRoutes = new Hono()
  .use('*', adminAuth, requireRole(ROLES.ADMIN))
  .route('/media', adminMediaRoutes)
  .route('/products', adminCatalogueRoutes)
  .route('/settings', adminSettingsRoutes)
  .route('/suppliers', adminSupplierRoutes)
  .route('/', adminTaxonomyRoutes)

export const adminRoutes = new Hono()
  .route('/auth', adminAuthRoutes)
  .route('/', adminDomainRoutes)
