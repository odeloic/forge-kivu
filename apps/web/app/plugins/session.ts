export default defineNuxtPlugin(async () => {
  const { user, refresh } = useSession()
  if (user.value === undefined) await refresh()
})
