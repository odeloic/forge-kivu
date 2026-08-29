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

const { pending: saving, error: actionError, run } = useAsyncAction()

const toggleVisible = () =>
  run(async () => {
    const supplier = data.value
    if (!supplier) return
    await update(supplier.id, { visible: !supplier.visible })
    await refresh()
  })

const confirming = ref(false)
const uploading = ref(false)

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

      <TabsContent value="gallery" class="panel gallery">
        <div class="gallery-header">
          <p class="muted">
            {{ data.gallery.length }}
            {{ data.gallery.length === 1 ? 'image' : 'images' }}
          </p>
          <div class="spacer" />
          <UiButton variant="primary" @click="uploading = true">
            Add images
          </UiButton>
        </div>

        <ul v-if="data.gallery.length" class="grid">
          <li v-for="item in data.gallery" :key="item.id" class="card">
            <img :src="item.imageUrl" :alt="item.altText ?? ''" />
            <p class="caption">{{ item.caption ?? 'No caption' }}</p>
            <p v-if="!item.altText" class="flag status-warn">Needs alt text</p>
          </li>
        </ul>
        <p v-else class="muted">No images yet.</p>
      </TabsContent>

      <TabsContent value="products" class="panel">
        <p class="muted">Supplier products are not wired up yet.</p>
      </TabsContent>
    </TabsRoot>

    <GalleryUploadDialog
      v-model:open="uploading"
      :supplier-id="data.id"
      @attached="refresh"
    />

    <UiConfirmDialog
      v-model:open="confirming"
      title="Delete supplier?"
      :description="`${data.name} is removed for good. A supplier that still has products cannot be deleted.`"
      @confirm="confirmRemove"
    />
  </section>
</template>

<style scoped>
.gallery {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.gallery-header {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: var(--space-7);
  list-style: none;
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.card img {
  aspect-ratio: 4 / 3;
  inline-size: 100%;
  border: var(--border-hairline) solid var(--color-rule);
  object-fit: cover;
}

.caption {
  font-size: var(--text-xs);
}

.flag {
  font-size: var(--text-2xs);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

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
