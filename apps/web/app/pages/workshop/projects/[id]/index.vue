<script setup lang="ts">
definePageMeta({ access: 'authenticated', layout: 'workshop' })

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'boq', label: 'Bill of quantities' },
  { value: 'settings', label: 'Settings' },
] as const

type TabValue = (typeof TABS)[number]['value']

const TAB_ALIASES: Record<string, TabValue> = {
  products: 'boq',
  boqs: 'boq',
}

const isTab = (value: unknown): value is TabValue =>
  TABS.some((entry) => entry.value === value)

const resolveTab = (value: unknown): TabValue => {
  if (isTab(value)) return value
  return (typeof value === 'string' && TAB_ALIASES[value]) || 'overview'
}

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))

const { detail, remove } = useProjects()
const { listForProject } = useBoqs()
const { settings, load: loadSettings } = useSettings()

await loadSettings()
const currency = computed(() => settings.value?.currency ?? '')

const { data, error, refresh } = await useAsyncData(
  () => `workshop-project-${id.value}`,
  () => detail(id.value).catch(rethrowAsNuxtError),
  { watch: [id] },
)

if (error.value) throw error.value

const { data: boqs, refresh: refreshBoqs } = await useAsyncData(
  () => `workshop-project-boqs-${id.value}`,
  () => listForProject(id.value),
  { watch: [id] },
)

const revisions = computed(() => boqs.value ?? [])

const tab = computed<TabValue>({
  get: () => resolveTab(route.query.tab),
  set: (value) => {
    if (value === resolveTab(route.query.tab)) return
    void router.replace({
      query: value === 'overview' ? {} : { tab: value },
    })
  },
})

const counts = computed<Record<TabValue, number | null>>(() => ({
  overview: null,
  boq: data.value?.items.length ?? 0,
  settings: null,
}))

const summary = computed(() => {
  const project = data.value
  if (!project) return ''
  const parts = [
    projectTypeLabel(project.projectType),
    project.workType ? workTypeLabel(project.workType) : null,
    project.location,
  ].filter(Boolean)
  return `${parts.join(' · ')} · Updated ${formatDateTime(project.updatedAt)}`
})

const { pending: acting, error: actionError, run } = useAsyncAction()

const confirming = ref(false)

const confirmRemove = () =>
  run(async () => {
    await remove(id.value)
    await navigateTo('/workshop/projects')
  })

const reload = async () => {
  await Promise.all([refresh(), refreshBoqs()])
}
</script>

<template>
  <section v-if="data" class="page">
    <p class="breadcrumb">
      <NuxtLink to="/workshop/projects">Projects</NuxtLink>
      <span class="muted"> / {{ data.name }}</span>
    </p>

    <div class="header">
      <h1>{{ data.name }}</h1>
      <span class="flag" :class="projectPhaseClass(data.phase)">
        {{ projectPhaseLabel(data.phase) }}
      </span>
      <div class="spacer" />
      <UiButton variant="ghost" :disabled="acting" @click="confirming = true">
        Delete
      </UiButton>
    </div>

    <p class="muted summary">{{ summary }}</p>

    <p v-if="actionError" class="note status-bad" role="alert">
      {{ errorMessage(actionError) }}
    </p>

    <TabsRoot v-model="tab" :unmount-on-hide="false" class="tabs">
      <TabsList class="tab-strip">
        <TabsTrigger
          v-for="item in TABS"
          :key="item.value"
          :value="item.value"
          class="tab"
        >
          {{ item.label }}
          <span v-if="counts[item.value] !== null" class="count">
            {{ counts[item.value] }}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" class="panel">
        <ProjectOverviewTab
          :project="data"
          :revisions="revisions"
          :currency="currency"
          @changed="reload"
        />
      </TabsContent>

      <TabsContent value="boq" class="panel">
        <ProjectBoqTab
          :project="data"
          :revisions="revisions"
          :currency="currency"
          @changed="reload"
        />
      </TabsContent>

      <TabsContent value="settings" class="panel">
        <ProjectSettingsTab
          :project="data"
          :currency="currency"
          @changed="reload"
        />
      </TabsContent>
    </TabsRoot>

    <UiConfirmDialog
      v-model:open="confirming"
      title="Delete project?"
      :description="`${data.name} is removed for good, with its selected products and every bill of quantities generated from it.`"
      @confirm="confirmRemove"
    />
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.breadcrumb {
  font-size: var(--text-xs);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-7);
}

.spacer {
  flex-grow: 1;
}

.flag {
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.summary {
  margin-block-start: calc(-1 * var(--space-6));
  font-size: var(--text-xs);
}

.tabs {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.tab-strip {
  display: flex;
  align-items: flex-end;
  gap: var(--space-11);
  border-block-end: var(--border-hairline) solid var(--color-rule);
}

.tab {
  padding: 0 0 var(--space-4);
  margin-block-end: calc(-1 * var(--border-hairline));
  border: 0;
  border-block-end: 2px solid transparent;
  color: var(--color-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-regular);
}

.tab .count {
  margin-inline-start: var(--space-3);
  color: var(--color-faint);
}

.tab[data-state='active'] .count {
  color: var(--color-muted);
}

.tab[data-state='active'] {
  border-block-end-color: var(--color-rule-strong);
  color: var(--color-ink);
  font-weight: var(--weight-medium);
}

.panel {
  padding-block-start: var(--space-1);
}

.panel[hidden] {
  display: none;
}
</style>
