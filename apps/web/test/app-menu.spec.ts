import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearNuxtState, useRouter } from '#imports'
import AppHeader from '../app/components/AppHeader.vue'

const { getCategories, getSpaces, getSuppliers, user, logout } = vi.hoisted(
  () => ({
    getCategories: vi.fn(),
    getSpaces: vi.fn(),
    getSuppliers: vi.fn(),
    user: {
      __v_isRef: true,
      value: null as null | { email: string; role: string },
    },
    logout: vi.fn(),
  }),
)
mockNuxtImport('useApi', () => () => ({
  categories: { $get: getCategories },
  spaces: { $get: getSpaces },
  suppliers: { $get: getSuppliers },
}))
mockNuxtImport('useSession', () => () => ({
  user,
  isAuthenticated: computed(() => Boolean(user.value)),
  logout,
}))

const category = (id: string, children: unknown[] = []) => ({
  id,
  name: id,
  slug: id,
  children,
})
const response = (data: unknown) => ({ ok: true, json: async () => data })
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
const button = (text: string) =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  ).find(
    (node) =>
      node.textContent?.trim() === text ||
      node.getAttribute('aria-label') === text,
  )!
const click = async (text: string) => {
  button(text).click()
  await flushPromises()
}
const open = async () => {
  ;(
    document.querySelector('[aria-label="Open menu"]') as HTMLButtonElement
  ).click()
  await flushPromises()
}
const columns = () => document.querySelectorAll('[data-menu-column]')

beforeEach(async () => {
  clearNuxtState()
  vi.clearAllMocks()
  user.value = null
  getCategories.mockResolvedValue(
    response([
      category('Root', [category('Branch', [category('Leaf')])]),
      ...Array.from({ length: 7 }, (_, i) => category(`Category ${i}`)),
    ]),
  )
  getSpaces.mockResolvedValue(
    response(
      Array.from({ length: 19 }, (_, i) => ({
        id: String(i),
        name: `Space ${i}`,
      })),
    ),
  )
  getSuppliers.mockResolvedValue(
    response([
      {
        id: 'supplier',
        name: 'Kigali Build Supply',
        slug: 'kigali-build-supply',
      },
    ]),
  )
  await useRouter().push('/')
  wrapper = await mountSuspended(AppHeader, { attachTo: document.body })
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

describe('fullscreen navigation', () => {
  it('opens the four-section dialog lazily and restores focus on Escape', async () => {
    expect(getCategories).not.toHaveBeenCalled()
    expect(document.querySelectorAll('header button')).toHaveLength(1)
    await open()
    expect(
      document.querySelectorAll('[aria-label="Public sections"] button'),
    ).toHaveLength(4)
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      'Log in',
    )
    expect(document.activeElement).toBe(button('Products'))
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Open menu')
    await open()
    expect(getCategories).toHaveBeenCalledTimes(1)
    expect(getSpaces).toHaveBeenCalledTimes(1)
    expect(getSuppliers).toHaveBeenCalledTimes(1)
  })
  it('drills three levels, moves focus and navigates a leaf', async () => {
    await open()
    await click('Products')
    expect(columns()).toHaveLength(1)
    expect(columns()[0]?.querySelectorAll('button')).toHaveLength(8)
    await click('Root')
    expect(columns()).toHaveLength(2)
    button('Branch').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )
    await flushPromises()
    expect(columns()).toHaveLength(3)
    expect(document.activeElement).toBe(button('Leaf'))
    button('Leaf').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    )
    await flushPromises()
    expect(document.activeElement).toBe(button('Branch'))
    await click('Leaf')
    await vi.waitFor(() =>
      expect(useRouter().currentRoute.value.fullPath).toBe('/?category=Leaf'),
    )
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
  it('resets depth for flat sections and leaves Brands empty', async () => {
    await open()
    await click('Products')
    await click('Root')
    await click('Branch')
    await click('Spaces')
    expect(columns()).toHaveLength(1)
    expect(columns()[0]?.querySelectorAll('button')).toHaveLength(19)
    await click('Brands')
    expect(columns()).toHaveLength(0)
    expect(button('Brands').getAttribute('aria-pressed')).toBe('true')
    await click('Suppliers')
    await click('Kigali Build Supply')
    await vi.waitFor(() =>
      expect(useRouter().currentRoute.value.path).toBe(
        '/suppliers/kigali-build-supply',
      ),
    )
    await open()
    expect(button('Suppliers').getAttribute('aria-pressed')).toBe('true')
    expect(columns()).toHaveLength(1)
  })
  it('shows failures and retries a selected section', async () => {
    getCategories
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
    await open()
    await click('Products')
    await flushPromises()
    expect(getCategories).toHaveBeenCalledTimes(2)
    expect(columns()).toHaveLength(1)
    expect(columns()[0]?.textContent).toBe('Could not load')
    await click('Products')
    expect(columns()[0]?.querySelectorAll('button')).toHaveLength(8)
  })
  it('filters sections through the route access policy', async () => {
    const record = useRouter().resolve('/brands').matched.at(-1)!
    const access = record.meta.access
    record.meta.access = 'admin-only'
    try {
      await open()
      expect(button('Brands')).toBeUndefined()
      expect(
        document.querySelectorAll('[aria-label="Public sections"] button'),
      ).toHaveLength(3)
    } finally {
      record.meta.access = access
    }
  })

  it('pushes one mobile level at a time and returns through parents', async () => {
    wrapper?.unmount()
    const media = vi
      .spyOn(window, 'matchMedia')
      .mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaQueryList)
    try {
      wrapper = await mountSuspended(AppHeader, { attachTo: document.body })
      await open()
      await click('Products')
      expect(button('Spaces')).toBeUndefined()
      await click('Root')
      expect(button('Category 0')).toBeUndefined()
      await click('Branch')
      expect(button('Leaf')).toBeDefined()
      await click('Back')
      expect(button('Branch')).toBeDefined()
      expect(button('Leaf')).toBeUndefined()
      await click('Back')
      expect(button('Root')).toBeDefined()
      await click('Back')
      expect(button('Spaces')).toBeDefined()
      expect(document.querySelectorAll('[role="dialog"] nav')).toHaveLength(1)
      await click('Brands')
      expect(button('Spaces')).toBeDefined()
      await click('Spaces')
      await click('Space 0')
      await vi.waitFor(() =>
        expect(useRouter().currentRoute.value.path).toBe('/spaces'),
      )
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      await open()
      expect(button('Space 0')).toBeDefined()
    } finally {
      media.mockRestore()
    }
  })

  it('shows the session email and logout', async () => {
    user.value = { email: 'member@example.com', role: 'user' }
    await open()
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      'member@example.com',
    )
    await click('Log out')
    expect(logout).toHaveBeenCalledOnce()
    expect(
      document.querySelector('[role="dialog"] a[href="/login"]'),
    ).toBeNull()
  })
})
