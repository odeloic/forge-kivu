import { describe, expect, it } from 'vitest'

import {
  attributeFormSchema,
  createAttributeSchema,
  createCategorySchema,
  createSpaceSchema,
  createUnitSchema,
  hexSchema,
  updateAttributeSchema,
  updateCategorySchema,
  updateSpaceSchema,
  updateUnitSchema,
} from '../taxonomy'

describe('taxonomy schemas', () => {
  it('normalises shared taxonomy values', () => {
    expect(hexSchema.parse(' #AABBCC ')).toBe('#aabbcc')
    expect(
      createCategorySchema.parse({ name: ' Roof ', slug: ' ROOF ' }),
    ).toMatchObject({ name: 'Roof', slug: 'roof' })
  })

  it('defaults attribute types and normalises empty form units', () => {
    expect(
      createAttributeSchema.parse({ name: 'Colour', slug: 'colour' }).type,
    ).toBe('text')
    expect(
      attributeFormSchema.parse({
        name: 'Colour',
        slug: 'colour',
        unit: ' ',
        type: 'color',
      }).unit,
    ).toBeNull()
  })

  it('validates unit and space inputs', () => {
    expect(
      createUnitSchema.parse({ name: 'Piece', symbol: 'pc', slug: 'piece' }),
    ).toMatchObject({ name: 'Piece', symbol: 'pc', slug: 'piece' })
    expect(
      createSpaceSchema.parse({ name: 'Bath', slug: 'bath' }),
    ).toMatchObject({ name: 'Bath', slug: 'bath' })
  })

  it.each([
    updateAttributeSchema,
    updateCategorySchema,
    updateSpaceSchema,
    updateUnitSchema,
  ])('rejects an empty update', (schema) => {
    expect(schema.safeParse({}).success).toBe(false)
  })
})
