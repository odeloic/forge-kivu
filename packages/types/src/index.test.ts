import { describe, expect, it } from 'vitest'

import { createTodoSchema, todoSchema } from './index'

describe('todoSchema', () => {
  it('accepts a valid todo', () => {
    const result = todoSchema.safeParse({
      id: 'a1',
      title: 'write tests',
      completed: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty title', () => {
    const result = todoSchema.safeParse({
      id: 'a1',
      title: '',
      completed: false,
    })
    expect(result.success).toBe(false)
  })
})

describe('createTodoSchema', () => {
  it('strips unknown fields', () => {
    const result = createTodoSchema.parse({ title: 'ship it', extra: true })
    expect(result).toEqual({ title: 'ship it' })
  })
})
