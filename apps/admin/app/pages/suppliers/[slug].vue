<script setup lang="ts">
definePageMeta({ access: 'admin-only' })

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'products', label: 'Products' },
] as const

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { list, detail, update, remove } = useSuppliers()

const { data, error, refresh } = await useAsyncData(
  () => `admin-supplier-${slug.value}`,
  async () => {
    const suppliers = await list()
    const supplier = suppliers.find((item) => item.slug === slug.value)
    if (!supplier) throw createError({ statusCode: 404 })
    return { ...supplier, ...(await detail(supplier.id)) }
  },
  { watch: [slug] },
)

if (error.value) throw error.value

const tab = ref<(typeof TABS)[number]['value']>('profile')

const counts = computed<Record<(typeof TABS)[number]['value'], number | null>>(
  () => ({
    profile: null,
    gallery: data.value?.gallery.length ?? 0,
    products: data.value?.productCount ?? 0,
  }),
)

const { pending: saving, error: actionError, run } = useAsyncAction()

const toggleVisible = () =>
  run(async () => {
    const supplier = data.value
    if (!supplier) return
    await update(supplier.id, { visible: !supplier.visible })
    await refresh()
  })

const confirming = ref(false)

const confirmRemove = () =>
  run(async () => {
    const supplier = data.value
    if (!supplier) return
    await remove(supplier.id)
    await navigateTo('/suppliers')
  })
</script>

<template>
  <section v-if="data" class="page">
    <p class="breadcrumb">
      <NuxtLink to="/suppliers">Suppliers</NuxtLink>
      <span class="muted"> / {{ data.name }}</span>
    </p>

    <div class="header">
      <h1>{{ data.name }}</h1>
      <span class="flag" :class="data.visible ? 'status-ok' : 'status-neutral'">
        {{ data.visible ? 'Visible' : 'Hidden' }}
      </span>
      <div class="spacer" />
      <UiButton :disabled="saving" @click="toggleVisible">
        {{ data.visible ? 'Hide from shop' : 'Show in shop' }}
      </UiButton>
      <UiButton variant="ghost" @click="confirming = true">Delete</UiButton>
    </div>

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

      <TabsContent value="profile" class="panel profile">
        <SupplierProfileImages
          :key="`images-${data.id}`"
          :supplier="data"
          @saved="refresh"
        />
        <SupplierProfileForm
          :key="`form-${data.id}`"
          :supplier="data"
          @saved="refresh"
        />
      </TabsContent>

      <TabsContent value="gallery" class="panel">
        <SupplierGalleryTab :supplier="data" :refresh="refresh" />
      </TabsContent>

      <TabsContent value="products" class="panel">
        <SupplierProductsTab :supplier-id="data.id" />
      </TabsContent>
    </TabsRoot>

    <UiConfirmDialog
      v-model:open="confirming"
      title="Delete supplier?"
      :description="`${data.name} is removed for good. A supplier that still has products cannot be deleted.`"
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

.tabs {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.tab-strip {
  display: flex;
  align-items: flex-end;
  gap: var(--space-11);
  border-bottom: var(--border-hairline) solid var(--color-rule);
}

.tab {
  padding: 0 0 var(--space-4);
  margin-bottom: calc(-1 * var(--border-hairline));
  border: 0;
  border-bottom: 2px solid transparent;
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
  border-bottom-color: var(--color-rule-strong);
  color: var(--color-ink);
  font-weight: var(--weight-medium);
}

.panel {
  padding-top: var(--space-2);
}

.panel[hidden] {
  display: none;
}

.profile {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
  max-inline-size: 44rem;
}
</style>
