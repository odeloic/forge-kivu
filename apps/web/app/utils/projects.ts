import {
  PROJECT_PHASE_VALUES,
  PROJECT_PHASES,
  PROJECT_TYPE_VALUES,
  PROJECT_TYPES,
  calculateLineTotal,
  sumAmounts,
  WORK_TYPE_VALUES,
  WORK_TYPES,
  type ProjectPhase,
  type ProjectType,
  type WorkType,
} from '@forge-kivu/types'

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  [PROJECT_TYPES.RESIDENTIAL_HOUSE]: 'Residential house',
  [PROJECT_TYPES.APARTMENT_BUILDING]: 'Apartment building',
  [PROJECT_TYPES.COMMERCIAL]: 'Commercial',
  [PROJECT_TYPES.INDUSTRIAL]: 'Industrial',
  [PROJECT_TYPES.INSTITUTIONAL]: 'Institutional',
  [PROJECT_TYPES.OTHER]: 'Other',
}

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  [WORK_TYPES.NEW_CONSTRUCTION]: 'New construction',
  [WORK_TYPES.RENOVATION]: 'Renovation',
  [WORK_TYPES.EXTENSION]: 'Extension',
  [WORK_TYPES.REPAIR]: 'Repair',
}

export const PROJECT_PHASE_LABELS: Record<ProjectPhase, string> = {
  [PROJECT_PHASES.FOUNDATION]: 'Foundation',
  [PROJECT_PHASES.STRUCTURE]: 'Structure',
  [PROJECT_PHASES.ROOFING]: 'Roofing',
  [PROJECT_PHASES.FINISHING]: 'Finishing',
}

export const PROJECT_PHASE_CLASSES: Record<ProjectPhase, string> = {
  [PROJECT_PHASES.FOUNDATION]: 'status-neutral',
  [PROJECT_PHASES.STRUCTURE]: 'status-neutral',
  [PROJECT_PHASES.ROOFING]: 'status-warn',
  [PROJECT_PHASES.FINISHING]: 'status-ok',
}

export const projectTypeOptions = PROJECT_TYPE_VALUES.map((value) => ({
  value,
  label: PROJECT_TYPE_LABELS[value],
}))

export const workTypeOptions = WORK_TYPE_VALUES.map((value) => ({
  value,
  label: WORK_TYPE_LABELS[value],
}))

export const projectPhaseOptions = PROJECT_PHASE_VALUES.map((value) => ({
  value,
  label: PROJECT_PHASE_LABELS[value],
}))

export const projectTypeLabel = (value: ProjectType): string =>
  PROJECT_TYPE_LABELS[value]

export const workTypeLabel = (value: WorkType | null): string =>
  value === null ? '—' : WORK_TYPE_LABELS[value]

export const projectPhaseLabel = (value: ProjectPhase | null): string =>
  value === null ? 'Not set' : PROJECT_PHASE_LABELS[value]

export const projectPhaseClass = (value: ProjectPhase | null): string =>
  value === null ? 'status-neutral' : PROJECT_PHASE_CLASSES[value]

export type ProjectLine = {
  variantId: string
  spaceId: string | null
  spaceName: string | null
  name: string
  sku: string | null
  label: string | null
  price: number | null
  quantity: number
}

export type LineRef = Pick<ProjectLine, 'variantId' | 'spaceId'>

export type LineDiff = {
  removed: ProjectLine[]
  upserts: ProjectLine[]
}

export const lineKey = (line: LineRef): string =>
  `${line.variantId}:${line.spaceId ?? ''}`

export const diffLines = (
  saved: ProjectLine[],
  current: ProjectLine[],
): LineDiff => {
  const kept = new Set(current.map(lineKey))
  const quantities = new Map(
    saved.map((line) => [lineKey(line), line.quantity] as const),
  )

  return {
    removed: saved.filter((line) => !kept.has(lineKey(line))),
    upserts: current.filter(
      (line) => quantities.get(lineKey(line)) !== line.quantity,
    ),
  }
}

export type LineItem = {
  variantId: string
  space: { id: string; name: string } | null
  quantity: number
}

export const findLine = <T extends LineItem>(
  items: T[],
  variantId: string,
  spaceId: string | null,
): T | null =>
  items.find(
    (item) =>
      item.variantId === variantId && (item.space?.id ?? null) === spaceId,
  ) ?? null

export const lineTotal = (line: ProjectLine): number =>
  line.price === null ? 0 : calculateLineTotal(line.price, line.quantity)

export const linesTotal = (lines: ProjectLine[]): number =>
  sumAmounts(lines, lineTotal)
