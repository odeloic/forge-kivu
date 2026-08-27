export default defineNuxtPlugin(() => {
  const user = useSessionState()
  const route = useRoute()

  watch(user, (current, previous) => {
    if (current !== null || !previous) return
    if (canAccess(resolveAccess(route), current)) return

    navigateTo({ path: '/login', query: { redirect: route.fullPath } })
  })
})
