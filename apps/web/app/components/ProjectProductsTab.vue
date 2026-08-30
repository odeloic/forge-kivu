<script setup lang="ts">
import type { ProjectDetail, ProjectItem } from '@forge-kivu/api-client'
import { PRODUCT_STATUSES } from '@forge-kivu/types'

const props = defineProps<{
  project: ProjectDetail
  currency: string
}>()

const emit = defineEmits<{ changed: [] }>()

const GROUPS = [
  { value: 'category', label: 'Category' },
  { value: 'supplier', label: 'Supplier' },
] as const

const { removeItem } = useProjects()

const groupBy = ref<(typeof GROUPS)[number]['value']>('category')
const search = ref('')

const itemTotal = (item: ProjectItem) =>
  item.price === null ? 0 : calculateLineTotal(item.price, item.quantity)

const isAvailable = (item: ProjectItem) =>
  item.product.status === PRODUCT_STATUSES.PUBLISHED

const materials = computed(() => sumAmounts(props.project.items, itemTotal))

const groupOf = (item: ProjectItem) =>
  groupBy.value === 'category' ? item.category : item.supplier

const visible = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return props.project.items
  return props.project.items.filter((item) =>
    [item.product.name, item.sku, item.label]
      .filter(Boolean)
      .some((value) => (value as string).toLowerCase().includes(term)),
  )
})

const groups = computed(() => {
  const byId = new Map<string, { name: string; items: ProjectItem[] }>()
  for (const item of visible.value) {
    const group = groupOf(item)
    const entry = byId.get(group.id) ?? { name: group.name, items: [] }
    entry.items.push(item)
    byId.set(group.id, entry)
  }
  return [...byId]
    .map(([id, entry]) => ({
      id,
      name: entry.name,
      items: entry.items,
      total: sumAmounts(entry.items, itemTotal),
    }))
    .sort((left, right) => right.total - left.total)
})

const peak = computed(() => groups.value[0]?.total ?? 0)

const largest = computed(() =>
  props.project.items.reduce<ProjectItem | null>(
    (best, item) =>
      best === null || itemTotal(item) > itemTotal(best) ? item : best,
    null,
  ),
)

const withdrawn = computed(() =>
  props.project.items.filter((item) => !isAvailable(item)),
)

const unpriced = computed(() =>
  props.project.items.filter(
    (item) => isAvailable(item) && item.price === null,
  ),
)

const budgetShare = computed(() => {
  const budget = props.project.budget
  if (budget === null || budget === 0) return null
  return materials.value / budget
})

const shareOf = (value: number) =>
  materials.value === 0 ? 0 : value / materials.value

const itemName = (item: ProjectItem) =>
  item.label ? `${item.product.name} — ${item.label}` : item.product.name

const caption = (item: ProjectItem) =>
  [item.sku, item.label].filter(Boolean).join(' · ')

const { pending: acting, error: actionError, run } = useAsyncAction()

const drop = (item: ProjectItem) =>
  run(async () => {
    await removeItem(props.project.id, item.variantId)
    emit('changed')
  })
</script>

<template>
  <div class="tab-body">
    <div class="controls">
      <div class="field">
        <Label for="group-by">Group by</Label>
        <select id="group-by" v-model="groupBy">
          <option
            v-for="option in GROUPS"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="field">
        <Label for="products-search">Search selection</Label>
        <input id="products-search" v-model="search" type="search" />
      </div>

      <div class="spacer" />

      <UiButton as-child>
        <NuxtLink :to="`/workshop/projects/${project.id}/products`">
          Add products
        </NuxtLink>
      </UiButton>
    </div>

    <p v-if="actionError" class="note status-bad" role="alert">
      {{ errorMessage(actionError) }}
    </p>

    <template v-if="project.items.length">
      <div class="columns">
        <div class="chart">
          <h2>Cost by {{ groupBy }}</h2>
          <ul class="chart-rows">
            <li v-for="group in groups" :key="group.id" class="chart-row">
              <span class="chart-label">{{ group.name }}</span>
              <span class="chart-track">
                <span
                  class="chart-fill"
                  :style="{
                    inlineSize:
                      peak === 0 ? '0%' : `${(group.total / peak) * 100}%`,
                  }"
                />
              </span>
              <span class="num chart-value">{{
                formatAmount(group.total)
              }}</span>
              <span class="muted chart-share">
                {{ formatPercent(shareOf(group.total)) }}
              </span>
            </li>
          </ul>
        </div>

        <ul class="tiles">
          <li class="tile lead">
            <span class="eyebrow">Materials total</span>
            <span class="tile-value">{{ formatAmount(materials) }}</span>
            <span class="muted tile-note">
              {{ currency
              }}<template v-if="budgetShare !== null">
                · {{ formatPercent(budgetShare) }} of budget
              </template>
            </span>
          </li>
          <li v-if="largest" class="tile">
            <span class="eyebrow">Largest line</span>
            <span class="tile-line">{{ itemName(largest) }}</span>
            <span class="muted tile-note">
              {{ formatAmount(itemTotal(largest)) }} {{ currency }} ·
              {{ formatPercent(shareOf(itemTotal(largest))) }} of materials
            </span>
          </li>
          <li class="tile">
            <span class="eyebrow">Attention</span>
            <span v-if="withdrawn.length" class="status-bad tile-line">
              {{ withdrawn.length }}
              {{ withdrawn.length === 1 ? 'product' : 'products' }}
              no longer available
            </span>
            <span v-else-if="unpriced.length" class="status-warn tile-line">
              {{ unpriced.length }}
              {{ unpriced.length === 1 ? 'line' : 'lines' }} without a price
            </span>
            <span v-else class="status-ok tile-line">
              Every line is priced and available
            </span>
          </li>
        </ul>
      </div>

      <table v-if="visible.length">
        <thead>
          <tr>
            <th class="image-column">Image</th>
            <th>Product · variant</th>
            <th class="supplier-column">Supplier</th>
            <th class="unit-column">Unit</th>
            <th class="qty-column">Qty</th>
            <th class="total-column">Line total</th>
            <th class="share-column">Share</th>
            <th class="remove-column" />
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groups" :key="group.id">
            <tr>
              <td colspan="8" class="group-cell">
                <span class="group-head">
                  <span class="eyebrow">
                    {{ group.name }} · {{ group.items.length }}
                    {{ group.items.length === 1 ? 'line' : 'lines' }}
                  </span>
                  <span class="spacer" />
                  <span class="num">{{ formatAmount(group.total) }}</span>
                </span>
              </td>
            </tr>
            <tr v-for="item in group.items" :key="item.variantId">
              <td>
                <span class="thumb">
                  <img
                    v-if="item.imageUrl"
                    :src="item.imageUrl"
                    :alt="item.product.name"
                  />
                </span>
              </td>
              <td>
                <div class="named">
                  <span class="ellip">{{ item.product.name }}</span>
                  <code class="ellip">{{ caption(item) }}</code>
                  <span
                    v-if="!isAvailable(item)"
                    class="flag status-bad withdrawn"
                  >
                    No longer available
                  </span>
                </div>
              </td>
              <td>
                <div class="ellip">{{ item.supplier.name }}</div>
              </td>
              <td v-if="item.price === null" class="muted unpriced">—</td>
              <td v-else class="num">{{ formatAmount(item.price) }}</td>
              <td class="num">{{ item.quantity }}</td>
              <td class="num">{{ formatAmount(itemTotal(item)) }}</td>
              <td>
                <span class="share">
                  <span class="share-track">
                    <span
                      class="share-fill"
                      :style="{
                        inlineSize: `${shareOf(itemTotal(item)) * 100}%`,
                      }"
                    />
                  </span>
                  <span class="muted share-value">
                    {{ formatShare(shareOf(itemTotal(item))) }}
                  </span>
                </span>
              </td>
              <td>
                <div class="actions">
                  <UiButton
                    variant="ghost"
                    :disabled="acting"
                    :aria-label="`Remove ${item.product.name}`"
                    @click="drop(item)"
                  >
                    ×
                  </UiButton>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <p v-else class="muted">No line matches this search.</p>

      <p v-if="withdrawn.length" class="note status-bad">
        {{ withdrawn.map((item) => itemName(item)).join(', ') }}
        {{ withdrawn.length === 1 ? 'was' : 'were' }} pulled from the catalogue
        after being added.
        {{ withdrawn.length === 1 ? 'It stays' : 'They stay' }}
        in this list and in existing revisions at the price
        {{ withdrawn.length === 1 ? 'it carried' : 'they carried' }}, but a new
        revision cannot be generated until
        {{ withdrawn.length === 1 ? 'it is' : 'they are' }} removed.
      </p>
      <p v-else-if="unpriced.length" class="note status-warn">
        {{ unpriced.length }}
        {{ unpriced.length === 1 ? 'line has' : 'lines have' }} no price yet. A
        new revision cannot be generated until every line is priced.
      </p>
    </template>

    <p v-else class="muted">
      No products selected yet. Add some to price this project.
    </p>
  </div>
</template>

<style scoped>
.tab-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.controls {
  display: flex;
  align-items: flex-end;
  gap: var(--space-6);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  inline-size: 13rem;
}

.spacer {
  flex-grow: 1;
}

.columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 20rem);
  gap: var(--space-12);
  align-items: start;
}

.chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  min-inline-size: 0;
}

.chart h2::first-letter {
  text-transform: uppercase;
}

.chart-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.chart-row {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.chart-label {
  inline-size: 6rem;
  flex: none;
  font-size: var(--text-xs);
}

.chart-track {
  flex-grow: 1;
  block-size: var(--space-5);
  background: var(--color-canvas);
}

.chart-fill {
  display: block;
  block-size: 100%;
  background: var(--color-accent);
}

.chart-value {
  inline-size: 5.5rem;
  flex: none;
}

.chart-share {
  inline-size: 3rem;
  flex: none;
  font-size: var(--text-2xs);
  text-align: end;
}

.tiles {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.tile {
  border-block-start: var(--border-hairline) solid var(--color-rule);
  padding-block-start: var(--space-5);
}

.tile.lead {
  border-block-start: 2px solid var(--color-rule-strong);
}

.tile-value {
  display: block;
  margin-block-start: var(--space-1);
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
}

.tile-line {
  display: block;
  margin-block-start: var(--space-1);
  font-size: var(--text-sm);
}

.tile-note {
  font-size: var(--text-2xs);
}

.image-column {
  inline-size: 3.5rem;
}

.supplier-column {
  inline-size: 8.5rem;
}

.unit-column {
  inline-size: 6.5rem;
  text-align: end;
}

.qty-column {
  inline-size: 4rem;
  text-align: end;
}

.total-column {
  inline-size: 7rem;
  text-align: end;
}

.share-column {
  inline-size: 8rem;
}

.remove-column {
  inline-size: 3.5rem;
}

.group-cell {
  padding: var(--space-7) 0 var(--space-2);
  border-block-end: var(--border-hairline) solid var(--color-rule-strong);
}

.group-head {
  display: flex;
  align-items: baseline;
  gap: var(--space-6);
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

.withdrawn {
  margin-block-start: var(--space-1);
}

.flag {
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
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

.share {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.share-track {
  flex-grow: 1;
  block-size: var(--space-3);
  background: var(--color-canvas);
}

.share-fill {
  display: block;
  block-size: 100%;
  background: var(--color-accent);
}

.share-value {
  font-size: var(--text-3xs);
  font-variant-numeric: tabular-nums;
}

.actions {
  display: flex;
  gap: var(--space-1);
  margin: 0 calc(-1 * var(--space-4));
}
</style>
