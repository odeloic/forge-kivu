import { globSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ROLES } from '@forge-kivu/types'

import {
  ACCESS,
  canAccess,
  DENIED_ACCESS,
  resolveAccess,
  type Access,
} from '../app/utils/access'

const route = (path: string, access?: Access) => ({
  path,
  meta: { access },
  matched: [{}],
})

const unmatched = (path: string) => ({ path, meta: {}, matched: [] })

const admin = { role: ROLES.ADMIN }
const basic = { role: ROLES.BASIC }
const pagesDirectory = resolve(process.cwd(), 'apps/web/app/pages')

describe('resolveAccess', () => {
  it('reads the declared access of a page', () => {
    expect(resolveAccess(route('/contact', ACCESS.PUBLIC))).toBe(ACCESS.PUBLIC)
    expect(resolveAccess(route('/login', ACCESS.GUEST))).toBe(ACCESS.GUEST)
  })

  it('denies a page that declares no access policy', () => {
    expect(resolveAccess(route('/account'))).toBe(DENIED_ACCESS)
  })

  it('does not derive access from the URL', () => {
    expect(resolveAccess(route('/admin', ACCESS.PUBLIC))).toBe(ACCESS.PUBLIC)
    expect(resolveAccess(route('/my-space', ACCESS.AUTHENTICATED))).toBe(
      ACCESS.AUTHENTICATED,
    )
  })

  it('leaves an unknown path public so it renders a 404', () => {
    expect(resolveAccess(unmatched('/nope'))).toBe(ACCESS.PUBLIC)
  })

  it('leaves an unknown path public regardless of its URL', () => {
    expect(resolveAccess(unmatched('/admin/nope'))).toBe(ACCESS.PUBLIC)
    expect(resolveAccess(unmatched('/workshop/nope'))).toBe(ACCESS.PUBLIC)
  })
})

describe('canAccess', () => {
  it('lets anyone reach a public page', () => {
    expect(canAccess(ACCESS.PUBLIC, null)).toBe(true)
    expect(canAccess(ACCESS.PUBLIC, basic)).toBe(true)
    expect(canAccess(ACCESS.PUBLIC, admin)).toBe(true)
  })

  it('keeps an authenticated user off a guest page', () => {
    expect(canAccess(ACCESS.GUEST, null)).toBe(true)
    expect(canAccess(ACCESS.GUEST, basic)).toBe(false)
    expect(canAccess(ACCESS.GUEST, admin)).toBe(false)
  })

  it('requires a session for an authenticated page', () => {
    expect(canAccess(ACCESS.AUTHENTICATED, null)).toBe(false)
    expect(canAccess(ACCESS.AUTHENTICATED, basic)).toBe(true)
    expect(canAccess(ACCESS.AUTHENTICATED, admin)).toBe(true)
  })

  it('requires the admin role for an admin-only page', () => {
    expect(canAccess(ACCESS.ADMIN_ONLY, null)).toBe(false)
    expect(canAccess(ACCESS.ADMIN_ONLY, basic)).toBe(false)
    expect(canAccess(ACCESS.ADMIN_ONLY, admin)).toBe(true)
  })

  it('denies a page with no declared policy', () => {
    expect(canAccess(DENIED_ACCESS, null)).toBe(false)
    expect(canAccess(DENIED_ACCESS, basic)).toBe(false)
    expect(canAccess(DENIED_ACCESS, admin)).toBe(false)
  })

  it('treats an unresolved session as no session', () => {
    expect(canAccess(ACCESS.AUTHENTICATED, undefined)).toBe(false)
    expect(canAccess(ACCESS.ADMIN_ONLY, undefined)).toBe(false)
    expect(canAccess(ACCESS.GUEST, undefined)).toBe(true)
  })
})

describe('page access declarations', () => {
  it('requires every page to declare a valid access policy', () => {
    const policies = new Set<Access>(Object.values(ACCESS))

    for (const page of globSync('**/*.vue', { cwd: pagesDirectory })) {
      const source = readFileSync(`${pagesDirectory}/${page}`, 'utf8')
      const declared = source.match(/\baccess:\s*'([^']+)'/)?.[1]

      expect(declared, `${page} must declare access`).toBeDefined()
      expect(
        policies.has(declared as Access),
        `${page} has invalid access`,
      ).toBe(true)
    }
  })
})
