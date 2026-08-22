import { ROLES } from '@forge-kivu/types'

const jsonHeaders = { headers: { 'content-type': 'application/json' } }

export const useSession = () => {
  const api = useApi()
  const user = useSessionState()

  const refresh = async () => {
    const res = await api.auth.me.$get()
    user.value = res.ok ? await res.json() : null
  }

  const login = async (email: string, password: string) => {
    const res = await api.auth.login.$post({ json: { email, password } })
    if (!res.ok) throw await toWebError(res)
    await refresh()
  }

  const signup = async (email: string, password: string) => {
    const res = await api.auth.signup.$post({ json: { email, password } })
    if (!res.ok) throw await toWebError(res)
    await refresh()
  }

  const logout = async () => {
    await api.auth.logout.$post({}, jsonHeaders)
    await navigateTo('/')
    user.value = null
  }

  return {
    user,
    isAuthenticated: computed(() => Boolean(user.value)),
    isAdmin: computed(() => user.value?.role === ROLES.ADMIN),
    refresh,
    login,
    signup,
    logout,
  }
}
