import { describe, expect, it } from 'vitest'

import { BOQ_COLUMNS, boqViewQuerySchema, exportQuerySchema } from './boq'

describe('boqViewQuerySchema', () => {
  it('defaults to every column, no group and sortOrder ascending', () => {
    expect(boqViewQuerySchema.parse({})).toEqual({
      view: 'gallery',
      columns: [...BOQ_COLUMNS],
      groupBy: null,
      sort: { field: 'sortOrder', direction: 'asc' },
    })
  })

  it('re-adds locked columns in canonical order', () => {
    expect(
      boqViewQuerySchema.parse({ columns: 'quantity,sku' }).columns,
    ).toEqual(['name', 'sku', 'quantity', 'lineTotal'])
  })

  it('parses sort and groupBy and rejects unknown values', () => {
    expect(
      boqViewQuerySchema.parse({ groupBy: 'space', sort: 'unitPrice:desc' }),
    ).toMatchObject({
      groupBy: 'space',
      sort: { field: 'unitPrice', direction: 'desc' },
    })
    expect(boqViewQuerySchema.safeParse({ columns: 'bogus' }).success).toBe(
      false,
    )
    expect(boqViewQuerySchema.safeParse({ sort: 'name' }).success).toBe(false)
    expect(boqViewQuerySchema.safeParse({ groupBy: 'sku' }).success).toBe(false)
  })

  it('falls back to the gallery view for unknown values', () => {
    expect(boqViewQuerySchema.parse({ view: 'table' }).view).toBe('gallery')
    expect(boqViewQuerySchema.parse({ view: 'boq' }).view).toBe('boq')
  })

  it('extends the view query with an export format', () => {
    expect(
      exportQuerySchema.parse({
        format: 'csv',
        columns: 'sku',
        groupBy: 'color',
        sort: 'name:asc',
      }),
    ).toEqual({
      format: 'csv',
      view: 'gallery',
      columns: ['name', 'sku', 'lineTotal'],
      groupBy: 'color',
      sort: { field: 'name', direction: 'asc' },
    })
  })
})
