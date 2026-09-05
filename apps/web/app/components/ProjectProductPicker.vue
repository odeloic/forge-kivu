<script setup lang="ts">
import type { ProjectSpace, VariantListItem } from '@forge-kivu/api-client'
import { PROJECT_LIMITS } from '@forge-kivu/types'

const lines = defineModel<ProjectLine[]>({ required: true })

const props = defineProps<{ currency: string; spaces: ProjectSpace[] }>()

const SEARCH_DELAY = 250

const { list } = useVariants()
const { tree } = useCategories()

const search = ref('')
const term = ref('')
const category = ref('')
const page = ref(1)
const target = ref('')

let timer: ReturnType<typeof setTimeout> | undefined

watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    term.value = value.trim()
    page.value = 1
  }, SEARCH_DELAY)
})

watch(category, () => {
  page.value = 1
})

onScopeDispose(() => clearTimeout(timer))

const { data: categories } = await useAsyncData('picker-categories', () =>
  tree(),
)

const categoryRows = computed(() => flattenCategories(categories.value ?? []))

const { data: variants, error } = await useAsyncData(
  'picker-variants',
  () =>
    list({
      ...(term.value ? { q: term.value } : {}),
      ...(category.value ? { category: category.value } : {}),
      page: String(page.value),
    }),
  { watch: [term, category, page] },
)

const spaceNameOf = (spaceId: string | null): string | null =>
  props.spaces.find((space) => space.id === spaceId)?.name ?? null

const targetSpaceId = computed(() => target.value || null)

const selected = computed(() => new Set(lines.value.map(lineKey)))

const isAdded = (variant: VariantListItem): boolean =>
  selected.value.has(
    lineKey({
      variantId: variant.variantId,
      spaceId: targetSpaceId.value,
    }),
  )

const heldSpaces = computed(() => {
  const byVariant = new Map<string, Set<string>>()
  for (const line of lines.value) {
    const held = byVariant.get(line.variantId) ?? new Set<string>()
    held.add(line.spaceId ?? '')
    byVariant.set(line.variantId, held)
  }
  return byVariant
})

const isTaken = (line: ProjectLine, spaceId: string | null): boolean =>
  (line.spaceId ?? '') !== (spaceId ?? '') &&
  Boolean(heldSpaces.value.get(line.variantId)?.has(spaceId ?? ''))

const lastPage = computed(() => {
  const pageSize = variants.value?.pageSize ?? 0
  if (pageSize === 0) return 1
  return Math.max(1, Math.ceil((variants.value?.total ?? 0) / pageSize))
})

const total = computed(() => linesTotal(lines.value))

const add = (variant: VariantListItem) => {
  if (isAdded(variant)) return
  lines.value = [
    ...lines.value,
    {
      variantId: variant.variantId,
      spaceId: targetSpaceId.value,
      spaceName: spaceNameOf(targetSpaceId.value),
      name: variant.product.name,
      sku: variant.sku,
      label: variant.label,
      price: variant.price,
      quantity: 1,
    },
  ]
}

const remove = (line: ProjectLine) => {
  const key = lineKey(line)
  lines.value = lines.value.filter((entry) => lineKey(entry) !== key)
  delete drafts[key]
}

const drafts = reactive<Record<string, string>>({})

const quantityOf = (line: ProjectLine): string =>
  drafts[lineKey(line)] ?? String(line.quantity)

const setQuantity = (line: ProjectLine, value: string) => {
  const key = lineKey(line)
  drafts[key] = value

  const quantity = Number(value)
  if (!Number.isFinite(quantity)) return
  if (quantity < 0.01 || quantity > PROJECT_LIMITS.quantity) return
  if (Math.round(quantity * 100) !== quantity * 100) return

  lines.value = lines.value.map((entry) =>
    lineKey(entry) === key ? { ...entry, quantity } : entry,
  )
}

const settleQuantity = (line: ProjectLine) => {
  delete drafts[lineKey(line)]
}

const setSpace = (line: ProjectLine, value: string) => {
  const spaceId = value || null
  const from = lineKey(line)
  const to = lineKey({ variantId: line.variantId, spaceId })
  if (from === to) return

  lines.value = lines.value.map((entry) =>
    lineKey(entry) === from
      ? { ...entry, spaceId, spaceName: spaceNameOf(spaceId) }
      : entry,
  )

  const draft = drafts[from]
  delete drafts[from]
  if (draft !== undefined) drafts[to] = draft
}

const variantName = (variant: VariantListItem) =>
  variant.label
    ? `${variant.product.name} — ${variant.label}`
    : variant.product.name

const lineCaption = (line: ProjectLine) =>
  [
    line.label ?? line.sku,
    line.price === null ? null : formatAmount(line.price),
  ]
    .filter(Boolean)
    .join(' · ')
</script>

<template>
  <div class="picker">
    <fieldset class="section">
      <legend>Catalogue</legend>

      <div class="filters">
        <div class="field grow">
          <Label for="pick-search">Search</Label>
          <input id="pick-search" v-model="search" type="search" />
        </div>
        <div class="field category">
          <Label for="pick-category">Category</Label>
          <select id="pick-category" v-model="category">
            <option value="">All categories</option>
            <option v-for="row in categoryRows" :key="row.id" :value="row.slug">
              {{ '— '.repeat(row.depth) }}{{ row.name }}
            </option>
          </select>
        </div>
        <div class="field target">
          <Label for="pick-target">Add to space</Label>
          <select id="pick-target" v-model="target">
            <option value="">— no space</option>
            <option v-for="space in spaces" :key="space.id" :value="space.id">
              {{ space.name }}
            </option>
          </select>
        </div>
      </div>

      <p v-if="error" class="note status-bad">
        {{ errorMessage(toErrorCode(error)) }}
      </p>

      <table v-if="variants?.items.length">
        <thead>
          <tr>
            <th class="image-column">Image</th>
            <th>Variant</th>
            <th class="supplier-column">Supplier</th>
            <th class="price-column">Unit price</th>
            <th class="add-column" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="variant in variants.items" :key="variant.variantId">
            <td>
              <span class="thumb">
                <img
                  v-if="variant.imageUrl"
                  :src="variant.imageUrl"
                  :alt="variant.product.name"
                />
              </span>
            </td>
            <td>
              <div class="named">
                <span class="ellip">{{ variantName(variant) }}</span>
                <code v-if="variant.sku" class="ellip">{{ variant.sku }}</code>
              </div>
            </td>
            <td>
              <div class="ellip">{{ variant.supplier.name }}</div>
            </td>
            <td v-if="variant.price === null" class="muted unpriced">
              Price on request
            </td>
            <td v-else class="num">{{ formatAmount(variant.price) }}</td>
            <td>
              <div class="actions">
                <UiButton
                  variant="ghost"
                  :disabled="isAdded(variant)"
                  @click="add(variant)"
                >
                  {{ isAdded(variant) ? 'Added' : 'Add' }}
                </UiButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-else-if="!error" class="muted">No variant matches this search.</p>

      <div v-if="lastPage > 1" class="pagination">
        <span class="muted count">Page {{ page }} of {{ lastPage }}</span>
        <UiButton :disabled="page <= 1" @click="page -= 1">Previous</UiButton>
        <UiButton :disabled="page >= lastPage" @click="page += 1">
          Next
        </UiButton>
      </div>
    </fieldset>

    <fieldset class="section">
      <legend>Selected · {{ lines.length }}</legend>

      <table v-if="lines.length">
        <thead>
          <tr>
            <th>Variant</th>
            <th class="space-column">Space</th>
            <th class="qty-column">Qty</th>
            <th class="line-column">Line</th>
            <th class="remove-column" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in lines" :key="lineKey(line)">
            <td>
              <div class="named">
                <span class="ellip">{{ line.name }}</span>
                <code class="ellip">{{ lineCaption(line) }}</code>
              </div>
            </td>
            <td>
              <select
                class="space"
                :aria-label="`Space for ${line.name}`"
                :value="line.spaceId ?? ''"
                @change="
                  setSpace(line, ($event.target as HTMLSelectElement).value)
                "
              >
                <option value="" :disabled="isTaken(line, null)">
                  — no space
                </option>
                <option
                  v-for="space in spaces"
                  :key="space.id"
                  :value="space.id"
                  :disabled="isTaken(line, space.id)"
                >
                  {{ space.name }}
                </option>
              </select>
            </td>
            <td>
              <input
                class="qty"
                type="number"
                inputmode="decimal"
                step="0.01"
                min="0.01"
                :aria-label="`Quantity for ${line.name}`"
                :value="quantityOf(line)"
                @input="
                  setQuantity(line, ($event.target as HTMLInputElement).value)
                "
                @blur="settleQuantity(line)"
              />
            </td>
            <td v-if="line.price === null" class="muted unpriced">—</td>
            <td v-else class="num">{{ formatAmount(lineTotal(line)) }}</td>
            <td>
              <div class="actions">
                <UiButton
                  variant="ghost"
                  :aria-label="`Remove ${line.name}`"
                  @click="remove(line)"
                >
                  ×
                </UiButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-else class="muted">Nothing selected yet.</p>

      <div class="total">
        <span class="eyebrow">Materials total</span>
        <div class="spacer" />
        <span class="total-value">{{ formatAmount(total) }}</span>
        <span class="muted currency">{{ props.currency }}</span>
      </div>
    </fieldset>
  </div>
</template>

<style scoped>
.picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 34rem);
  gap: var(--space-11);
  align-items: start;
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.filters {
  display: flex;
  align-items: flex-end;
  gap: var(--space-6);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-inline-size: 0;
}

.field.grow {
  flex-grow: 1;
}

.field.category {
  inline-size: 11rem;
}

.field.target {
  inline-size: 10rem;
}

.image-column {
  inline-size: 3.5rem;
}

.supplier-column {
  inline-size: 8rem;
}

.price-column {
  inline-size: 7rem;
  text-align: end;
}

.add-column {
  inline-size: 5rem;
}

.space-column {
  inline-size: 9.5rem;
}

.qty-column {
  inline-size: 4.5rem;
  text-align: end;
}

.line-column {
  inline-size: 6.5rem;
  text-align: end;
}

.remove-column {
  inline-size: 2.5rem;
}

.thumb {
  display: block;
  overflow: hidden;
  inline-size: 2.75rem;
  block-size: 2.25rem;
  border: var(--border-hairline) solid var(--color-rule);
  background: var(--color-canvas);
}

.thumb img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

.named {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
}

.ellip {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.num {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.unpriced {
  font-size: var(--text-2xs);
  text-align: end;
}

.space {
  inline-size: 100%;
  font-size: var(--text-xs);
}

.qty {
  inline-size: 100%;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-align: end;
}

.actions {
  display: flex;
  gap: var(--space-1);
  margin: 0 calc(-1 * var(--space-4));
}

.pagination {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.count {
  flex-grow: 1;
  font-size: var(--text-xs);
}

.total {
  display: flex;
  align-items: baseline;
  gap: var(--space-8);
  border-block-start: 2px solid var(--color-rule-strong);
  padding-block-start: var(--space-5);
}

.spacer {
  flex-grow: 1;
}

.total-value {
  font-family: var(--font-mono);
  font-size: var(--text-md);
  font-variant-numeric: tabular-nums;
}

.currency {
  font-size: var(--text-2xs);
}
</style>
