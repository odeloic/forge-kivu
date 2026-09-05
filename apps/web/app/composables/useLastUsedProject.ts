import { z } from 'zod'

const STORAGE_KEY = 'forge-kivu.add-to-project'

const memorySchema = z.object({
  projectId: z.string().nullable().catch(null),
  spaceByProject: z.record(z.string(), z.string().nullable()).catch({}),
})

export type LastUsedProject = z.infer<typeof memorySchema>

const empty = (): LastUsedProject => ({ projectId: null, spaceByProject: {} })

const read = (): LastUsedProject => {
  if (!import.meta.client) return empty()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return empty()
    const parsed = memorySchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : empty()
  } catch {
    return empty()
  }
}

const write = (memory: LastUsedProject): void => {
  if (!import.meta.client) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
  } catch {
    return
  }
}

export const useLastUsedProject = () => {
  const memory = ref<LastUsedProject>(read())

  const remember = (projectId: string, spaceId: string | null) => {
    memory.value = {
      projectId,
      spaceByProject: { ...memory.value.spaceByProject, [projectId]: spaceId },
    }
    write(memory.value)
  }

  const spaceFor = (projectId: string): string | null | undefined =>
    memory.value.spaceByProject[projectId]

  return {
    projectId: computed(() => memory.value.projectId),
    spaceFor,
    remember,
  }
}
