export default defineNuxtRouteMiddleware((to) => {
  const user = useSessionState()
  const access = resolveAccess(to)

  if (canAccess(access, user.value)) return

  if (access === ACCESS.GUEST) return navigateTo('/')

  if (access === DENIED_ACCESS) throw createWebError('FORBIDDEN')

  if (!user.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  throw createWebError('FORBIDDEN')
})
