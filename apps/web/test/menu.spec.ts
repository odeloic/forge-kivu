import { describe, expect, it } from 'vitest'
import { categoryMenuItems, menuColumns } from '../app/utils/menu'

const tree = [
  {
    id: 'root',
    name: 'Root',
    slug: 'root',
    children: [
      {
        id: 'branch',
        name: 'Branch',
        slug: 'branch',
        children: [{ id: 'leaf', name: 'Leaf', slug: 'a & b', children: [] }],
      },
    ],
  },
]

describe('menu tree', () => {
  it('creates precisely one column per selected depth', () => {
    const items = categoryMenuItems(tree)
    expect(menuColumns(items, [])).toHaveLength(1)
    expect(menuColumns(items, ['root'])).toHaveLength(2)
    expect(menuColumns(items, ['root', 'branch'])).toHaveLength(3)
    expect(menuColumns(items, ['different', 'branch'])).toHaveLength(1)
    expect(menuColumns([], [])).toEqual([])
  })
  it('encodes leaf category targets', () => {
    expect(
      menuColumns(categoryMenuItems(tree), ['root', 'branch'])[2]?.[0]?.target,
    ).toBe('/?category=a%20%26%20b')
  })
})
