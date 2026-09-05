import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLastUsedProject } from '../app/composables/useLastUsedProject'

const KABEZA = 'kabeza-house'
const NYARUTARAMA = 'nyarutarama-flats'
const KITCHEN = 'kitchen-space'

const stubStorage = (seed: Record<string, string> = {}) => {
  const entries = new Map(Object.entries(seed))

  const storage = {
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      entries.delete(key)
    }),
    clear: vi.fn(() => entries.clear()),
    key: vi.fn(() => null),
    get length() {
      return entries.size
    },
  }

  vi.stubGlobal('localStorage', storage)
  return storage
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useLastUsedProject', () => {
  beforeEach(() => {
    stubStorage()
  })

  it('starts empty when nothing is stored', () => {
    const { projectId, spaceFor } = useLastUsedProject()

    expect(projectId.value).toBeNull()
    expect(spaceFor(KABEZA)).toBeUndefined()
  })

  it('remembers the project and its space', () => {
    const { projectId, spaceFor, remember } = useLastUsedProject()

    remember(KABEZA, KITCHEN)

    expect(projectId.value).toBe(KABEZA)
    expect(spaceFor(KABEZA)).toBe(KITCHEN)
    expect(spaceFor(NYARUTARAMA)).toBeUndefined()
  })

  it('remembers no space as null, not as forgotten', () => {
    const { spaceFor, remember } = useLastUsedProject()

    remember(KABEZA, null)

    expect(spaceFor(KABEZA)).toBeNull()
  })

  it('keeps a space per project', () => {
    const { projectId, spaceFor, remember } = useLastUsedProject()

    remember(KABEZA, KITCHEN)
    remember(NYARUTARAMA, null)

    expect(projectId.value).toBe(NYARUTARAMA)
    expect(spaceFor(KABEZA)).toBe(KITCHEN)
    expect(spaceFor(NYARUTARAMA)).toBeNull()
  })

  it('writes one key that the next reader picks up', () => {
    const storage = stubStorage()

    useLastUsedProject().remember(KABEZA, KITCHEN)

    expect(storage.setItem).toHaveBeenCalledWith(
      'forge-kivu.add-to-project',
      JSON.stringify({
        projectId: KABEZA,
        spaceByProject: { [KABEZA]: KITCHEN },
      }),
    )
    expect(useLastUsedProject().projectId.value).toBe(KABEZA)
  })

  it('ignores stored junk', () => {
    stubStorage({ 'forge-kivu.add-to-project': 'not json' })

    expect(useLastUsedProject().projectId.value).toBeNull()
  })

  it('ignores a stored shape it does not recognise', () => {
    stubStorage({
      'forge-kivu.add-to-project': JSON.stringify({ projectId: 7 }),
    })

    const { projectId, spaceFor } = useLastUsedProject()

    expect(projectId.value).toBeNull()
    expect(spaceFor(KABEZA)).toBeUndefined()
  })

  it('survives storage that refuses to answer', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new Error('denied')
      }),
      setItem: vi.fn(() => {
        throw new Error('denied')
      }),
    })

    const { projectId, remember } = useLastUsedProject()

    expect(projectId.value).toBeNull()
    expect(() => remember(KABEZA, KITCHEN)).not.toThrow()
    expect(projectId.value).toBe(KABEZA)
  })
})
