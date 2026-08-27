import type { Role } from '@forge-kivu/types'

export type SessionState = { role: Role } | null | undefined

export const useSessionState = () =>
  useState<SessionState>('session', () => undefined)
