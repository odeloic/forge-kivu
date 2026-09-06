import type { LocationQuery, LocationQueryRaw } from 'vue-router'

import {
  BOQ_COLUMNS,
  BOQ_DEFAULT_SORT,
  BOQ_DEFAULT_VIEW,
  BOQ_VIEWS,
  type BoqViewQuery,
  boqViewQuerySchema,
  serialiseBoqView,
} from '@forge-kivu/types'

const VIEW_KEYS = ['view', 'columns', 'groupBy', 'sort'] as const

const sameColumns = (columns: readonly string[]): boolean =>
  columns.length === BOQ_COLUMNS.length &&
  columns.every((column, index) => column === BOQ_COLUMNS[index])

export const parseBoqView = (query: LocationQuery): BoqViewQuery => {
  const parsed = boqViewQuerySchema.safeParse(query)
  return parsed.success ? parsed.data : BOQ_DEFAULT_VIEW
}

export const boqViewParams = (
  view: BoqViewQuery,
): Partial<Record<(typeof VIEW_KEYS)[number], string>> => {
  const params = serialiseBoqView(view)
  if (view.view === BOQ_VIEWS.GALLERY) delete params.view
  if (sameColumns(view.columns)) delete params.columns
  if (view.groupBy === null) delete params.groupBy
  if (
    view.sort.field === BOQ_DEFAULT_SORT.field &&
    view.sort.direction === BOQ_DEFAULT_SORT.direction
  ) {
    delete params.sort
  }
  return params
}

export const nextBoqQuery = (
  query: LocationQuery,
  patch: Partial<BoqViewQuery>,
): LocationQueryRaw => {
  const view = boqViewQuerySchema.parse({
    ...serialiseBoqView({ ...parseBoqView(query), ...patch }),
  })
  const rest: LocationQueryRaw = { ...query }
  for (const key of VIEW_KEYS) delete rest[key]
  return { ...rest, ...boqViewParams(view) }
}

export const useBoqView = () => {
  const route = useRoute()
  const router = useRouter()

  const view = computed(() => parseBoqView(route.query))

  const write = (patch: Partial<BoqViewQuery>) =>
    router.replace({ query: nextBoqQuery(route.query, patch) })

  return { view, write }
}
