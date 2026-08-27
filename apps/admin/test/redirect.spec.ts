import { describe, expect, it } from 'vitest'

import { safeRedirect } from '../app/utils/redirect'

describe('safeRedirect', () => {
  it('keeps a local path', () => {
    expect(safeRedirect('/products')).toBe('/products')
    expect(safeRedirect('/products?status=draft#top')).toBe(
      '/products?status=draft#top',
    )
  })

  it('rejects a path that leaves the admin origin', () => {
    expect(safeRedirect('//evil.example')).toBe('/')
    expect(safeRedirect('/\\evil.example')).toBe('/')
    expect(safeRedirect('https://evil.example/products')).toBe('/')
    expect(safeRedirect('products')).toBe('/')
  })

  it('falls back when the query carries no usable value', () => {
    expect(safeRedirect(undefined)).toBe('/')
    expect(safeRedirect(['/a', '/b'])).toBe('/')
    expect(safeRedirect('/login', '/products')).toBe('/login')
    expect(safeRedirect(null, '/products')).toBe('/products')
  })
})
