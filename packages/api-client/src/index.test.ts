import { describe, expect, it, vi } from 'vitest'

import { createClient } from './index'

describe('createClient', () => {
  it('requests the auth me endpoint against the given base url', async () => {
    const user = {
      id: 'u1',
      email: 'user@example.com',
      role: 'basic',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(user), {
          headers: { 'content-type': 'application/json' },
        }),
    )
    const client = createClient('http://api.test', { fetch: fetchMock })

    const res = await client.auth.me.$get()

    expect(await res.json()).toEqual(user)
    const request = fetchMock.mock.calls[0]?.[0]
    expect(String(request)).toBe('http://api.test/auth/me')
  })
})
