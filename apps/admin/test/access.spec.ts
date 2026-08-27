import { globSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ACCESS, type Access } from '@forge-kivu/nuxt-base/app/utils/access'

const pagesDirectory = resolve(
  fileURLToPath(new URL('../app/pages', import.meta.url)),
)

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
