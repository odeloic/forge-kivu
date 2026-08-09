const readError = async (res: Response): Promise<string> => {
  const body: unknown = await res.json()
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string'
  ) {
    return body.error
  }
  return 'Request failed'
}

const jsonHeaders = { headers: { 'content-type': 'application/json' } }

export const useAuth = () => {
  const api = useApi()

  const { data: user, refresh } = useAsyncData('auth-user', async () => {
    const res = await api.auth.me.$get()
    return res.ok ? await res.json() : null
  })

  const signup = async (email: string, password: string) => {
    const res = await api.auth.signup.$post({ json: { email, password } })
    if (!res.ok) throw new Error(await readError(res))
    await refresh()
  }

  const login = async (email: string, password: string) => {
    const res = await api.auth.login.$post({ json: { email, password } })
    if (!res.ok) throw new Error(await readError(res))
    await refresh()
  }

  const logout = async () => {
    await api.auth.logout.$post({}, jsonHeaders)
    await refresh()
  }

  return { user, refresh, signup, login, logout }
}
