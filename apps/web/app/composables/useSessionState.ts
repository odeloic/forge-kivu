import type { SessionUser } from '@forge-kivu/api-client'

export type SessionState = SessionUser | null | undefined

export const useSessionState = () =>
  useState<SessionState>('session', () => undefined)
