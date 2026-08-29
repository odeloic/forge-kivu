import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { toTypedSchema } from '../app/utils/validation'

const schema = z.object({
  name: z.string().min(1, 'Name is required.'),
  slug: z.string().regex(/^[a-z-]+$/, 'Lowercase only.'),
  tags: z.array(z.string().min(2, 'Too short.')),
})

describe('toTypedSchema', () => {
  it('marks itself as a vee-validate typed schema', () => {
    expect(toTypedSchema(schema).__type).toBe('VVTypedSchema')
  })

  it('returns the parsed output and no errors when valid', async () => {
    const result = await toTypedSchema(schema).parse({
      name: 'Kivu',
      slug: 'kivu',
      tags: ['one'],
    })

    expect(result.errors).toEqual([])
    expect(result.value).toEqual({ name: 'Kivu', slug: 'kivu', tags: ['one'] })
  })

  it('maps each issue to its field path', async () => {
    const result = await toTypedSchema(schema).parse({
      name: '',
      slug: 'Not A Slug',
      tags: ['ok'],
    })

    expect(result.value).toBeUndefined()
    expect(result.errors).toEqual([
      { path: 'name', errors: ['Name is required.'] },
      { path: 'slug', errors: ['Lowercase only.'] },
    ])
  })

  it('groups several issues under one path', async () => {
    const strict = z.object({
      code: z.string().min(4, 'Too short.').regex(/^\d+$/, 'Digits only.'),
    })

    const result = await toTypedSchema(strict).parse({ code: 'ab' })

    expect(result.errors).toEqual([
      { path: 'code', errors: ['Too short.', 'Digits only.'] },
    ])
  })

  it('renders array indices in bracket notation', async () => {
    const result = await toTypedSchema(schema).parse({
      name: 'Kivu',
      slug: 'kivu',
      tags: ['ok', 'x'],
    })

    expect(result.errors).toEqual([{ path: 'tags[1]', errors: ['Too short.'] }])
  })

  it('applies the schema transforms to the returned value', async () => {
    const trimmed = z.object({
      note: z
        .string()
        .transform((value) => (value.trim() === '' ? null : value.trim()))
        .pipe(z.string().nullable()),
    })

    const result = await toTypedSchema(trimmed).parse({ note: '   ' })

    expect(result.value).toEqual({ note: null })
  })
})
