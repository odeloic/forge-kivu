<script setup lang="ts">
definePageMeta({ access: 'authenticated', layout: 'workshop' })

const route = useRoute()
const id = computed(() => String(route.params.id))

const { detail, setItem, removeItem } = useProjects()
const { settings, load: loadSettings } = useSettings()

await loadSettings()
const currency = computed(() => settings.value?.currency ?? '')

const { data, error } = await useAsyncData(
  () => `workshop-project-picker-${id.value}`,
  () => detail(id.value).catch(rethrowAsNuxtError),
  { watch: [id] },
)

if (error.value) throw error.value

const toLine = (item: {
  variantId: string
  product: { name: string }
  sku: string | null
  label: string | null
  price: number | null
  quantity: number
}): ProjectLine => ({
  variantId: item.variantId,
  name: item.product.name,
  sku: item.sku,
  label: item.label,
  price: item.price,
  quantity: item.quantity,
})

const savedLines = computed(() => (data.value?.items ?? []).map(toLine))

const lines = ref<ProjectLine[]>(savedLines.value.map((line) => ({ ...line })))

const back = computed(() => `/workshop/projects/${id.value}?tab=products`)

const { pending: saving, error: actionError, run } = useAsyncAction()

const save = () =>
  run(async () => {
    const kept = new Set(lines.value.map((line) => line.variantId))
    for (const line of savedLines.value) {
      if (!kept.has(line.variantId)) await removeItem(id.value, line.variantId)
    }

    const previous = new Map(
      savedLines.value.map((line) => [line.variantId, line.quantity]),
    )
    for (const line of lines.value) {
      if (previous.get(line.variantId) === line.quantity) continue
      await setItem(id.value, line.variantId, line.quantity)
    }

    await navigateTo(back.value)
  })
</script>

<template>
  <section v-if="data" class="page">
    <p class="breadcrumb">
      <NuxtLink to="/workshop/projects">Projects</NuxtLink>
      <span class="muted"> / </span>
      <NuxtLink :to="`/workshop/projects/${data.id}`">{{ data.name }}</NuxtLink>
      <span class="muted"> / Products</span>
    </p>

    <div class="header">
      <h1>Products</h1>
      <span class="flag status-neutral">
        {{ projectTypeLabel(data.projectType) }}
        <template v-if="data.workType">
          · {{ workTypeLabel(data.workType) }}
        </template>
      </span>
      <div class="spacer" />
      <UiButton as-child variant="ghost">
        <NuxtLink :to="back">Cancel</NuxtLink>
      </UiButton>
      <UiButton variant="primary" :disabled="saving" @click="save">
        {{ saving ? 'Saving…' : 'Save products' }}
      </UiButton>
    </div>

    <p v-if="actionError" class="note status-bad" role="alert">
      {{ errorMessage(actionError) }}
    </p>

    <ProjectProductPicker v-model="lines" :currency="currency" />
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
</style>
