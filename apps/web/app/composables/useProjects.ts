import type {
  Project,
  ProjectDetail,
  ProjectItem,
  ProjectListItem,
  ProjectPhaseCompletion,
} from '@forge-kivu/api-client'
import type {
  CreateProjectInput,
  ProjectPhase,
  ProjectSort,
  ProjectType,
  UpdateProjectInput,
} from '@forge-kivu/types'

export type ProjectQuery = {
  projectType?: ProjectType
  phase?: ProjectPhase
  sort?: ProjectSort
}

export const useProjects = () => {
  const api = useApi()

  const list = async (query: ProjectQuery = {}): Promise<ProjectListItem[]> => {
    const res = await api.projects.$get({ query })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const detail = async (id: string): Promise<ProjectDetail> => {
    const res = await api.projects[':id'].$get({ param: { id } })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const create = async (input: CreateProjectInput): Promise<Project> => {
    const res = await api.projects.$post({ json: input })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const update = async (
    id: string,
    patch: UpdateProjectInput,
  ): Promise<Project> => {
    const res = await api.projects[':id'].$patch({ param: { id }, json: patch })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const remove = async (id: string): Promise<void> => {
    const res = await api.projects[':id'].$delete({ param: { id } })
    if (!res.ok) throw await toApiError(res)
  }

  const setItem = async (
    id: string,
    variantId: string,
    quantity: number,
    spaceId?: string | null,
  ): Promise<ProjectItem> => {
    const res = await api.projects[':id'].items[':variantId'].$put({
      param: { id, variantId },
      json: { quantity, spaceId },
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const removeItem = async (
    id: string,
    variantId: string,
    spaceId?: string,
  ): Promise<void> => {
    const res = await api.projects[':id'].items[':variantId'].$delete({
      param: { id, variantId },
      query: spaceId ? { spaceId } : {},
    })
    if (!res.ok) throw await toApiError(res)
  }

  const setPhaseCompletion = async (
    id: string,
    phase: ProjectPhase,
    completedOn: string,
  ): Promise<ProjectPhaseCompletion> => {
    const res = await api.projects[':id'].phases[':phase'].$put({
      param: { id, phase },
      json: { completedOn },
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const clearPhaseCompletion = async (
    id: string,
    phase: ProjectPhase,
  ): Promise<void> => {
    const res = await api.projects[':id'].phases[':phase'].$delete({
      param: { id, phase },
    })
    if (!res.ok) throw await toApiError(res)
  }

  return {
    list,
    detail,
    create,
    update,
    remove,
    setItem,
    removeItem,
    setPhaseCompletion,
    clearPhaseCompletion,
  }
}
