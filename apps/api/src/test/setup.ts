import { afterAll } from 'vitest'

import { emptyBucket } from './media'

afterAll(async () => {
  await emptyBucket()
})
