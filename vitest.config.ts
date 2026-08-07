import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['apps/api', 'apps/web', 'packages/types', 'packages/api-client'],
  },
})
