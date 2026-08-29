import { describe, expect, it } from 'vitest'

import { useAsyncAction } from '../app/composables/useAsyncAction'
import { ApiError } from '../app/utils/errors'

const deferred = () => {
  let resolve!: () => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useAsyncAction', () => {
  it('tracks pending across a successful action', async () => {
    const { pending, error, run } = useAsyncAction()
    const gate = deferred()

    const running = run(() => gate.promise)
    expect(pending.value).toBe(true)

    gate.resolve()
    await running
    expect(pending.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('captures the error code and resets pending on failure', async () => {
    const { pending, error, run } = useAsyncAction()

    await run(() => Promise.reject(new ApiError('SLUG_TAKEN')))
    expect(pending.value).toBe(false)
    expect(error.value).toBe('SLUG_TAKEN')
  })

  it('maps unknown failures to INTERNAL', async () => {
    const { error, run } = useAsyncAction()

    await run(() => Promise.reject(new Error('boom')))
    expect(error.value).toBe('INTERNAL')
  })

  it('ignores reentrant runs while pending', async () => {
    const { run } = useAsyncAction()
    const gate = deferred()
    let calls = 0

    const running = run(async () => {
      calls += 1
      await gate.promise
    })
    await run(async () => {
      calls += 1
    })
    expect(calls).toBe(1)

    gate.resolve()
    await running
  })

  it('clears a previous error when a new run starts', async () => {
    const { error, run } = useAsyncAction()

    await run(() => Promise.reject(new ApiError('SLUG_TAKEN')))
    expect(error.value).toBe('SLUG_TAKEN')

    await run(() => Promise.resolve())
    expect(error.value).toBeNull()
  })
})
