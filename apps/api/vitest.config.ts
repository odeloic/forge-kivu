import { defineProject } from 'vitest/config'

import { testBucket } from './src/test/bucket.ts'
import { testDatabaseUrl } from './src/test/database-url.ts'

export default defineProject({
  test: {
    name: 'api',
    environment: 'node',
    env: {
      DATABASE_URL: testDatabaseUrl(),
      S3_BUCKET: testBucket(),
      LOG_LEVEL: 'silent',
    },
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false,
    server: { deps: { inline: ['zod'] } },
  },
})
