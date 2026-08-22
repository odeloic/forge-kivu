export type NavEntry = {
  path: string
  label: string
}

export const PRIMARY_NAV: readonly NavEntry[] = [
  { path: '/', label: 'Home' },
  { path: '/products', label: 'Products' },
  { path: '/spaces', label: 'Spaces' },
  { path: '/brands', label: 'Brands' },
  { path: '/suppliers', label: 'Suppliers' },
  { path: '/contact', label: 'Contact' },
  { path: '/workshop', label: 'Workshop' },
  { path: '/admin', label: 'Admin' },
]

export const WORKSHOP_NAV: readonly NavEntry[] = [
  { path: '/workshop', label: 'Workshop' },
  { path: '/workshop/projects', label: 'Projects' },
]

export const ADMIN_NAV: readonly NavEntry[] = [
  { path: '/admin', label: 'Dashboard' },
]

export const projectNav = (id: string): readonly NavEntry[] => [
  { path: `/workshop/projects/${id}/overview`, label: 'Overview' },
  { path: `/workshop/projects/${id}/boqs`, label: 'BOQs' },
  { path: `/workshop/projects/${id}/inventory`, label: 'Inventory' },
  { path: `/workshop/projects/${id}/settings`, label: 'Settings' },
]
