import { describe, expect, it, vi } from 'vitest'

import { createClient } from './index'

describe('createClient', () => {
  it('requests the todos endpoint against the given base url', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify([]), {
          headers: { 'content-type': 'application/json' },
        }),
    )
    const client = createClient('http://api.test', { fetch: fetchMock })

    const res = await client.todos.$get()

    expect(await res.json()).toEqual([])
    const request = fetchMock.mock.calls[0]?.[0]
    expect(String(request)).toBe('http://api.test/todos')
  })
})
