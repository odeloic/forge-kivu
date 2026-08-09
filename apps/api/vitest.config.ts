import { defineProject } from 'vitest/config'

import { testDatabaseUrl } from './src/test/database-url.ts'

export default defineProject({
  test: {
    name: 'api',
    environment: 'node',
    env: {
      DATABASE_URL: testDatabaseUrl(),
      LOG_LEVEL: 'silent',
    },
    globalSetup: ['./src/test/global-setup.ts'],
    fileParallelism: false,
    server: { deps: { inline: ['zod'] } },
  },
})
