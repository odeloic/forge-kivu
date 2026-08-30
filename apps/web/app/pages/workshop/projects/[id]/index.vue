<script setup lang="ts">
definePageMeta({ access: 'authenticated', layout: 'workshop' })

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'products', label: 'Products' },
  { value: 'boqs', label: 'BOQs' },
  { value: 'settings', label: 'Settings' },
] as const

type TabValue = (typeof TABS)[number]['value']

const isTab = (value: unknown): value is TabValue =>
  TABS.some((entry) => entry.value === value)

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))

const { detail, remove } = useProjects()
const { listForProject, generate } = useBoqs()
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
const latest = computed(() => revisions.value[0] ?? null)
const nextRevision = computed(() => (latest.value?.revision ?? 0) + 1)

const tab = computed<TabValue>({
  get: () => (isTab(route.query.tab) ? route.query.tab : 'overview'),
  set: (value) => {
    void router.replace({
      query: value === 'overview' ? {} : { tab: value },
    })
  },
})

const counts = computed<Record<TabValue, number | null>>(() => ({
  overview: null,
  products: data.value?.items.length ?? 0,
  boqs: revisions.value.length,
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

const generateRevision = () =>
  run(async () => {
    await generate(id.value)
    await refreshBoqs()
    tab.value = 'boqs'
  })

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
      <UiButton
        variant="primary"
        :disabled="acting || data.items.length === 0"
        @click="generateRevision"
      >
        {{ acting ? 'Working…' : `Generate revision ${nextRevision}` }}
      </UiButton>
      <UiButton variant="ghost" @click="confirming = true">Delete</UiButton>
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

      <TabsContent value="products" class="panel">
        <ProjectProductsTab
          :project="data"
          :currency="currency"
          @changed="reload"
        />
      </TabsContent>

      <TabsContent value="boqs" class="panel">
        <ProjectBoqsTab :revisions="revisions" :currency="currency" />
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
