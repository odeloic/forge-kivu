<script setup lang="ts">
import type { BoqSummary, ProjectDetail } from '@forge-kivu/api-client'
import {
  BOQ_DEFAULT_SORT,
  BOQ_VIEWS,
  type BoqSortField,
  type BoqViewQuery,
  arrangeLines,
  sumAmounts,
  visibleColumns,
} from '@forge-kivu/types'

import {
  type LineView,
  isUnpriced,
  isWithdrawn,
  lineName,
  lineTotalOf,
  toLineView,
} from '../utils/lines'

const props = defineProps<{
  project: ProjectDetail
  revisions: BoqSummary[]
  currency: string
}>()

const emit = defineEmits<{ changed: [] }>()

const route = useRoute()
const router = useRouter()

const { setItem, removeItem } = useProjects()
const { detail, generate } = useBoqs()
const { view, write } = useBoqView()

const selectedId = computed(() => {
  const requested = route.query.revision
  return props.revisions.some((row) => row.id === requested)
    ? String(requested)
    : null
})

const workingCopy = computed(() => selectedId.value === null)

const select = (id: string | null) => {
  const { revision, ...rest } = route.query
  void revision
  void router.replace({
    query:
      id === null
        ? { ...rest, tab: 'boq' }
        : { ...rest, tab: 'boq', revision: id },
  })
}

const {
  data: boq,
  error: boqError,
  pending: boqPending,
} = await useAsyncData(
  () => `project-boq-${selectedId.value ?? 'working'}`,
  () => (selectedId.value ? detail(selectedId.value) : Promise.resolve(null)),
  { watch: [selectedId] },
)

const selectedSummary = computed(
  () => props.revisions.find((row) => row.id === selectedId.value) ?? null,
)

const lines = computed<LineView[]>(() => {
  if (workingCopy.value) {
    return props.project.items.map((item, index) => toLineView(item, index))
  }
  return (boq.value?.items ?? []).map((item) => toLineView(item))
})

const filters = useLineFilters(lines)

const groups = computed(() =>
  arrangeLines(filters.visible, {
    groupBy: view.value.groupBy,
    sort: view.value.sort,
  }),
)

const columns = computed(() => visibleColumns(view.value))

const sourceTotal = computed(() => sumAmounts(lines.value, lineTotalOf))

const withdrawn = computed(() => lines.value.filter(isWithdrawn))

const unpriced = computed(() =>
  lines.value.filter((line) => !isWithdrawn(line) && isUnpriced(line)),
)

const canGenerate = computed(
  () =>
    workingCopy.value &&
    lines.value.length > 0 &&
    withdrawn.value.length === 0 &&
    unpriced.value.length === 0,
)

const showLoading = computed(
  () =>
    !workingCopy.value &&
    boqPending.value &&
    boq.value?.id !== selectedId.value,
)

const sourceReady = computed(
  () =>
    workingCopy.value ||
    (boq.value !== null && boq.value?.id === selectedId.value),
)

const updateView = (patch: Partial<BoqViewQuery>) => write(patch)

const sortBy = (field: BoqSortField) => {
  const current = view.value.sort
  if (current.field !== field)
    return write({ sort: { field, direction: 'asc' } })
  if (current.direction === 'asc')
    return write({ sort: { field, direction: 'desc' } })
  return write({ sort: BOQ_DEFAULT_SORT })
}

const table = ref<{ resetDrafts: () => void } | null>(null)

const { pending: acting, error: actionError, run } = useAsyncAction()

const changeQuantity = (line: LineView, quantity: number) =>
  run(async () => {
    if (!line.variantId) return
    try {
      await setItem(props.project.id, line.variantId, quantity, line.spaceId)
    } catch (cause) {
      table.value?.resetDrafts()
      throw cause
    }
    emit('changed')
  })

const drop = (line: LineView) =>
  run(async () => {
    if (!line.variantId) return
    await removeItem(
      props.project.id,
      line.variantId,
      line.spaceId ?? undefined,
    )
    emit('changed')
  })

const generateRevision = () =>
  run(async () => {
    const created = await generate(props.project.id)
    emit('changed')
    await router.replace({
      query: { ...route.query, tab: 'boq', revision: created.id },
    })
  })
</script>

<template>
  <div class="tab-body">
    <ProjectRevisionStrip
      :revisions="revisions"
      :selected-id="selectedId"
      :working-count="project.items.length"
      :latest-boq="project.latestBoq"
      :boq="sourceReady && !workingCopy ? (boq ?? null) : null"
      :view="view"
      :currency="currency"
      :can-generate="canGenerate"
      :generating="acting"
      @select="select"
      @generate="generateRevision"
    />

    <ProjectLineControls
      v-model:search="filters.search"
      :view="view"
      :project-id="project.id"
      :working-copy="workingCopy"
      @update="updateView"
    />

    <p v-if="actionError" class="note status-bad" role="alert">
      {{ errorMessage(actionError) }}
    </p>

    <p v-if="boqError" class="note status-bad">
      {{ errorMessage(toErrorCode(boqError)) }}
    </p>

    <p v-else-if="showLoading" class="muted">
      Loading revision {{ selectedSummary?.revision }}…
    </p>

    <template v-else-if="sourceReady">
      <ProjectLineFilters :filters="filters" />

      <template v-if="lines.length === 0">
        <p class="muted">
          No products selected yet. Add some to price this project.
        </p>
        <UiButton v-if="workingCopy" as-child class="add">
          <NuxtLink :to="`/workshop/projects/${project.id}/products`">
            Add products
          </NuxtLink>
        </UiButton>
      </template>

      <template v-else-if="filters.visible.length === 0">
        <p class="muted">No line matches these filters.</p>
        <UiButton variant="ghost" class="add" @click="filters.clearAll">
          Clear all
        </UiButton>
      </template>

      <template v-else-if="view.view === BOQ_VIEWS.BOQ">
        <ProjectLineSummary
          :lines="lines"
          :group-by="view.groupBy"
          :budget="project.budget"
          :currency="currency"
        />
        <ProjectLineTable
          ref="table"
          :groups="groups"
          :columns="columns"
          :view="view"
          :source-total="sourceTotal"
          :source-count="lines.length"
          :working-copy="workingCopy"
          :pending="acting"
          @sort="sortBy"
          @quantity="changeQuantity"
          @remove="drop"
        />
      </template>

      <ProjectLineGallery
        v-else
        :groups="groups"
        :grouped="view.groupBy !== null"
        :working-copy="workingCopy"
        :pending="acting"
        @quantity="changeQuantity"
        @remove="drop"
      />

      <template v-if="lines.length > 0">
        <p v-if="workingCopy && withdrawn.length" class="note status-bad">
          {{ withdrawn.map((line) => lineName(line)).join(', ') }}
          {{ withdrawn.length === 1 ? 'was' : 'were' }} pulled from the
          catalogue after being added.
          {{ withdrawn.length === 1 ? 'It stays' : 'They stay' }}
          in this list and in existing revisions at the price
          {{ withdrawn.length === 1 ? 'it carried' : 'they carried' }}, but a
          new revision cannot be generated until
          {{ withdrawn.length === 1 ? 'it is' : 'they are' }} removed.
        </p>
        <p v-else-if="workingCopy && unpriced.length" class="note status-warn">
          {{ unpriced.length }}
          {{ unpriced.length === 1 ? 'line has' : 'lines have' }} no price yet.
          A new revision cannot be generated until every line is priced.
        </p>
        <p v-else-if="!workingCopy && withdrawn.length" class="note status-bad">
          {{ withdrawn.map((line) => line.name).join(', ') }}
          {{ withdrawn.length === 1 ? 'was' : 'were' }} pulled from the
          catalogue after this revision was generated. The
          {{ withdrawn.length === 1 ? 'line keeps' : 'lines keep' }} the price
          {{ withdrawn.length === 1 ? 'it was' : 'they were' }} frozen with;
          {{ withdrawn.length === 1 ? 'it is' : 'they are' }} flagged, never
          hidden, and {{ withdrawn.length === 1 ? 'exports' : 'export' }} with
          the rest.
        </p>
      </template>
    </template>
  </div>
</template>

<style scoped>
.tab-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.add {
  align-self: flex-start;
}
</style>
