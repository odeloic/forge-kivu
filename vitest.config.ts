import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'apps/admin',
      'apps/web',
      'packages/types',
      'packages/api-client',
      'packages/nuxt-base',
    ],
  },
})
