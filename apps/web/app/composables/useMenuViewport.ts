export const useMenuViewport = () => {
  const mobile = ref(false)
  let media: MediaQueryList | undefined
  const sync = () => {
    mobile.value = media?.matches ?? false
  }
  onMounted(() => {
    media = window.matchMedia('(max-width: 1023px)')
    sync()
    media.addEventListener('change', sync)
  })
  onBeforeUnmount(() => media?.removeEventListener('change', sync))
  return mobile
}
