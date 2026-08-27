import type { RouteLocationNormalized } from 'vue-router'

import { ROLES, type Role } from '@forge-kivu/types'

export const ACCESS = {
  PUBLIC: 'public',
  GUEST: 'guest',
  AUTHENTICATED: 'authenticated',
  ADMIN_ONLY: 'admin-only',
} as const

export type Access = (typeof ACCESS)[keyof typeof ACCESS]
export const DENIED_ACCESS = 'denied' as const
export type ResolvedAccess = Access | typeof DENIED_ACCESS

declare module 'vue-router' {
  interface RouteMeta {
    access?: Access
  }
}

type AccessRoute = Pick<RouteLocationNormalized, 'meta'> & {
  matched: readonly unknown[]
}

type AccessUser = { role: Role } | null | undefined

export const resolveAccess = (route: AccessRoute): ResolvedAccess => {
  if (route.matched.length === 0) return ACCESS.PUBLIC
  return route.meta.access ?? DENIED_ACCESS
}

export const canAccess = (
  access: ResolvedAccess,
  user: AccessUser,
): boolean => {
  switch (access) {
    case ACCESS.PUBLIC:
      return true
    case ACCESS.GUEST:
      return !user
    case ACCESS.AUTHENTICATED:
      return Boolean(user)
    case ACCESS.ADMIN_ONLY:
      return user?.role === ROLES.ADMIN
    case DENIED_ACCESS:
      return false
  }
}
