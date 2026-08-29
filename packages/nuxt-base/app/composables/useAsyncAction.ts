import { readonly, ref, type Ref } from 'vue'

import type { ErrorCode } from '@forge-kivu/types'

import { toErrorCode } from '../utils/errors'

export type UseAsyncActionReturn = {
  pending: Readonly<Ref<boolean>>
  error: Ref<ErrorCode | null>
  run: (action: () => Promise<void>) => Promise<void>
}

export const useAsyncAction = (): UseAsyncActionReturn => {
  const pending = ref(false)
  const error = ref<ErrorCode | null>(null)

  const run = async (action: () => Promise<void>) => {
    if (pending.value) return
    pending.value = true
    error.value = null
    try {
      await action()
    } catch (cause) {
      error.value = toErrorCode(cause)
    } finally {
      pending.value = false
    }
  }

  return { pending: readonly(pending), error, run }
}
