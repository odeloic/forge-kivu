import { describe, expect, it } from 'vitest'

import { todoSchema } from '@forge-kivu/types'

import { app } from '@/index'

describe('todos routes', () => {
  it('starts with an empty list', async () => {
    const res = await app.request('/todos')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('creates a todo and returns it in the list', async () => {
    const created = await app.request('/todos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'first todo' }),
    })
    expect(created.status).toBe(201)

    const list = await app.request('/todos')
    const body = todoSchema.array().parse(await list.json())
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({ title: 'first todo', completed: false })
  })

  it('rejects an invalid body', async () => {
    const res = await app.request('/todos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    })
    expect(res.status).toBe(400)
  })
})
