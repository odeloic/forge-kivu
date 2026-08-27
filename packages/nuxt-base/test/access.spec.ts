import { describe, expect, it } from 'vitest'

import { ROLES } from '@forge-kivu/types'

import {
  ACCESS,
  canAccess,
  DENIED_ACCESS,
  resolveAccess,
  type Access,
} from '../app/utils/access'

const route = (access?: Access) => ({ meta: { access }, matched: [{}] })
const unmatched = () => ({ meta: {}, matched: [] })

const admin = { role: ROLES.ADMIN }
const basic = { role: ROLES.BASIC }

describe('resolveAccess', () => {
  it('reads the declared access of a page', () => {
    expect(resolveAccess(route(ACCESS.PUBLIC))).toBe(ACCESS.PUBLIC)
    expect(resolveAccess(route(ACCESS.GUEST))).toBe(ACCESS.GUEST)
    expect(resolveAccess(route(ACCESS.AUTHENTICATED))).toBe(
      ACCESS.AUTHENTICATED,
    )
    expect(resolveAccess(route(ACCESS.ADMIN_ONLY))).toBe(ACCESS.ADMIN_ONLY)
  })

  it('denies a matched page without an access policy', () => {
    expect(resolveAccess(route())).toBe(DENIED_ACCESS)
  })

  it('leaves an unmatched route public so Nuxt can render a 404', () => {
    expect(resolveAccess(unmatched())).toBe(ACCESS.PUBLIC)
  })
})

describe('canAccess', () => {
  it('allows public routes for every session state', () => {
    expect(canAccess(ACCESS.PUBLIC, null)).toBe(true)
    expect(canAccess(ACCESS.PUBLIC, undefined)).toBe(true)
    expect(canAccess(ACCESS.PUBLIC, basic)).toBe(true)
    expect(canAccess(ACCESS.PUBLIC, admin)).toBe(true)
  })

  it('allows only signed-out visitors on guest routes', () => {
    expect(canAccess(ACCESS.GUEST, null)).toBe(true)
    expect(canAccess(ACCESS.GUEST, undefined)).toBe(true)
    expect(canAccess(ACCESS.GUEST, basic)).toBe(false)
    expect(canAccess(ACCESS.GUEST, admin)).toBe(false)
  })

  it('requires a session on authenticated routes', () => {
    expect(canAccess(ACCESS.AUTHENTICATED, null)).toBe(false)
    expect(canAccess(ACCESS.AUTHENTICATED, undefined)).toBe(false)
    expect(canAccess(ACCESS.AUTHENTICATED, basic)).toBe(true)
    expect(canAccess(ACCESS.AUTHENTICATED, admin)).toBe(true)
  })

  it('allows only admins on admin routes', () => {
    expect(canAccess(ACCESS.ADMIN_ONLY, null)).toBe(false)
    expect(canAccess(ACCESS.ADMIN_ONLY, undefined)).toBe(false)
    expect(canAccess(ACCESS.ADMIN_ONLY, basic)).toBe(false)
    expect(canAccess(ACCESS.ADMIN_ONLY, admin)).toBe(true)
  })

  it('denies undeclared access for every session state', () => {
    expect(canAccess(DENIED_ACCESS, null)).toBe(false)
    expect(canAccess(DENIED_ACCESS, undefined)).toBe(false)
    expect(canAccess(DENIED_ACCESS, basic)).toBe(false)
    expect(canAccess(DENIED_ACCESS, admin)).toBe(false)
  })
})
