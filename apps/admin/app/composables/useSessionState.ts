import type { AdminUser } from '@forge-kivu/api-client'

export type SessionState = AdminUser | null | undefined

export const useSessionState = () =>
  useState<SessionState>('admin-session', () => undefined)
