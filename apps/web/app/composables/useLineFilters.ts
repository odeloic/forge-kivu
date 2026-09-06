import type { Ref } from 'vue'

import {
  LINE_SHOW,
  LINE_SHOW_VALUES,
  type LineShow,
  type LineView,
  isPriced,
  isUnpriced,
  isWithdrawn,
  matchesSearch,
  showPredicate,
  spaceLabelOf,
} from '../utils/lines'

export const UNASSIGNED_SPACE = '__unassigned__'

export const SHOW_LABELS: Record<LineShow, string> = {
  [LINE_SHOW.ALL]: 'All',
  [LINE_SHOW.PRICED]: 'Priced',
  [LINE_SHOW.UNPRICED]: 'Unpriced',
  [LINE_SHOW.WITHDRAWN]: 'No longer available',
}

export type FilterOption = { value: string; label: string; count: number }

export type FilterChip = { key: string; label: string; drop: () => void }

const spaceKey = (line: LineView): string => line.spaceName ?? UNASSIGNED_SPACE

const spaceLabel = (key: string): string =>
  key === UNASSIGNED_SPACE ? spaceLabelOf({ spaceName: null }) : key

const countBy = (
  lines: readonly LineView[],
  keyOf: (line: LineView) => string,
  labelOf: (key: string) => string,
  active: string | null,
): FilterOption[] => {
  const counts = new Map<string, number>()
  for (const line of lines) {
    const key = keyOf(line)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (active !== null && !counts.has(active)) counts.set(active, 0)
  return [...counts]
    .map(([value, count]) => ({ value, label: labelOf(value), count }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export const useLineFilters = (lines: Ref<readonly LineView[]>) => {
  const show = ref<LineShow>(LINE_SHOW.ALL)
  const category = ref<string | null>(null)
  const supplier = ref<string | null>(null)
  const space = ref<string | null>(null)
  const search = ref('')

  const showOptions = computed<FilterOption[]>(() =>
    LINE_SHOW_VALUES.map((value) => ({
      value,
      label: SHOW_LABELS[value],
      count: lines.value.filter(showPredicate(value)).length,
    })),
  )

  const categoryOptions = computed(() =>
    countBy(
      lines.value,
      (line) => line.categoryName,
      (key) => key,
      category.value,
    ),
  )

  const supplierOptions = computed(() =>
    countBy(
      lines.value,
      (line) => line.supplierName,
      (key) => key,
      supplier.value,
    ),
  )

  const spaceOptions = computed(() =>
    countBy(lines.value, spaceKey, spaceLabel, space.value),
  )

  const counts = computed(() => ({
    priced: lines.value.filter(isPriced).length,
    unpriced: lines.value.filter(isUnpriced).length,
    withdrawn: lines.value.filter(isWithdrawn).length,
  }))

  const visible = computed(() => {
    const matchesShow = showPredicate(show.value)
    return lines.value.filter(
      (line) =>
        matchesShow(line) &&
        (category.value === null || line.categoryName === category.value) &&
        (supplier.value === null || line.supplierName === supplier.value) &&
        (space.value === null || spaceKey(line) === space.value) &&
        matchesSearch(line, search.value),
    )
  })

  const chips = computed<FilterChip[]>(() => {
    const rows: FilterChip[] = []
    if (show.value !== LINE_SHOW.ALL) {
      rows.push({
        key: 'show',
        label: SHOW_LABELS[show.value],
        drop: () => {
          show.value = LINE_SHOW.ALL
        },
      })
    }
    if (category.value !== null) {
      rows.push({
        key: 'category',
        label: category.value,
        drop: () => {
          category.value = null
        },
      })
    }
    if (supplier.value !== null) {
      rows.push({
        key: 'supplier',
        label: supplier.value,
        drop: () => {
          supplier.value = null
        },
      })
    }
    if (space.value !== null) {
      rows.push({
        key: 'space',
        label: spaceLabel(space.value),
        drop: () => {
          space.value = null
        },
      })
    }
    return rows
  })

  const isFiltered = computed(
    () => chips.value.length > 0 || search.value.trim().length > 0,
  )

  const setShow = (value: LineShow) => {
    show.value = value
  }

  const setFacet = (
    key: 'category' | 'supplier' | 'space',
    value: string | null,
  ) => {
    if (key === 'category') category.value = value
    else if (key === 'supplier') supplier.value = value
    else space.value = value
  }

  const clearAll = () => {
    show.value = LINE_SHOW.ALL
    category.value = null
    supplier.value = null
    space.value = null
    search.value = ''
  }

  return reactive({
    show,
    category,
    supplier,
    space,
    search,
    showOptions,
    categoryOptions,
    supplierOptions,
    spaceOptions,
    counts,
    visible,
    chips,
    isFiltered,
    setShow,
    setFacet,
    clearAll,
  })
}

export type LineFilters = ReturnType<typeof useLineFilters>
