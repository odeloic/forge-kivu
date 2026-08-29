export type SupplierImageField = 'logoMediaId' | 'featuredMediaId'

export const useSupplierImage = (
  supplierId: () => string,
  field: SupplierImageField,
  onSaved: () => Promise<void> | void,
) => {
  const { update } = useSuppliers()

  const {
    pending: detaching,
    error: detachError,
    run: runDetach,
  } = useAsyncAction()

  const {
    items,
    add,
    retry: retryUpload,
    clear,
  } = useMediaUpload({
    concurrency: 1,
    onReady: async (item) => {
      if (!item.mediaId) return
      await update(supplierId(), { [field]: item.mediaId })
      await onSaved()
    },
  })

  const item = computed<UploadItem | null>(() => items.value[0] ?? null)

  const pick = (files: Iterable<File>) => {
    const [file] = Array.from(files)
    if (!file) return
    clear()
    detachError.value = null
    add([file])
  }

  const retry = () => {
    if (item.value) retryUpload(item.value.id)
  }

  const detach = () =>
    runDetach(async () => {
      clear()
      await update(supplierId(), { [field]: null })
      await onSaved()
    })

  return {
    item,
    pending: computed(
      () => item.value !== null && item.value.status !== 'ready',
    ),
    busy: computed(
      () =>
        detaching.value ||
        (item.value !== null &&
          item.value.status !== 'ready' &&
          item.value.status !== 'failed'),
    ),
    error: computed(() => detachError.value ?? item.value?.error ?? null),
    pick,
    retry,
    detach,
  }
}
