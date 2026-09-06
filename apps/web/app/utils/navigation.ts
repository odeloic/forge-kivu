export type NavEntry = {
  path: string
  label: string
}

export const PRIMARY_NAV: readonly NavEntry[] = [
  { path: '/products', label: 'Products' },
  { path: '/spaces', label: 'Spaces' },
  { path: '/brands', label: 'Brands' },
  { path: '/suppliers', label: 'Suppliers' },
]

export const WORKSHOP_NAV: readonly NavEntry[] = [
  { path: '/workshop', label: 'Overview' },
  { path: '/workshop/projects', label: 'Projects' },
]

export const ADMIN_NAV: readonly NavEntry[] = [
  { path: '/admin', label: 'Dashboard' },
]

export const activeNavPath = (
  entries: readonly NavEntry[],
  path: string,
): string | null =>
  entries.reduce<string | null>((longest, entry) => {
    const matches = path === entry.path || path.startsWith(`${entry.path}/`)
    if (!matches) return longest
    if (longest !== null && longest.length >= entry.path.length) return longest
    return entry.path
  }, null)

export const MENU_ENDPOINTS = {
  '/products': 'categories',
  '/spaces': 'spaces',
  '/suppliers': 'suppliers',
} as const
