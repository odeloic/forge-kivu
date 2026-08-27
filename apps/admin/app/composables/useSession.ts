import { ROLES } from '@forge-kivu/types'

const jsonHeaders = { headers: { 'content-type': 'application/json' } }

export const useSession = () => {
  const api = useApi()
  const user = useSessionState()

  const refresh = async () => {
    const res = await api.admin.auth.me.$get()
    user.value = res.ok ? await res.json() : null
  }

  const login = async (email: string, password: string) => {
    const res = await api.admin.auth.login.$post({ json: { email, password } })
    if (!res.ok) throw await toApiError(res)
    await refresh()
  }

  const logout = async () => {
    await api.admin.auth.logout.$post({}, jsonHeaders)
    user.value = null
    await navigateTo('/login')
  }

  return {
    user,
    isAdmin: computed(() => user.value?.role === ROLES.ADMIN),
    refresh,
    login,
    logout,
  }
}
