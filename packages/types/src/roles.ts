export const ROLES = {
  BASIC: 'basic',
  ADMIN: 'admin',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]
