import type { BoqDetail, BoqSummary } from '@forge-kivu/api-client'
import {
  type BoqViewQuery,
  type ExportFormat,
  serialiseBoqView,
} from '@forge-kivu/types'

export const useBoqs = () => {
  const api = useApi()
  const config = useRuntimeConfig()

  const listForProject = async (projectId: string): Promise<BoqSummary[]> => {
    const res = await api.projects[':projectId'].boqs.$get({
      param: { projectId },
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const detail = async (id: string): Promise<BoqDetail> => {
    const res = await api.boqs[':id'].$get({ param: { id } })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const generate = async (projectId: string): Promise<BoqDetail> => {
    const res = await api.projects[':projectId'].boqs.$post({
      param: { projectId },
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const exportUrl = (
    id: string,
    format: ExportFormat,
    view: Partial<BoqViewQuery> = {},
  ): string => {
    const params = new URLSearchParams({ format, ...serialiseBoqView(view) })
    return `${config.public.apiBase}/boqs/${id}/export?${params.toString()}`
  }

  return { listForProject, detail, generate, exportUrl }
}
