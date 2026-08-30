<script setup lang="ts">
import type { BoqItem, BoqSummary } from '@forge-kivu/api-client'
import { EXPORT_FORMATS, PRODUCT_STATUSES } from '@forge-kivu/types'

const props = defineProps<{
  revisions: BoqSummary[]
  currency: string
}>()

const route = useRoute()
const router = useRouter()

const { detail, exportUrl } = useBoqs()

const selectedId = computed(() => {
  const requested = route.query.revision
  const known = props.revisions.some((row) => row.id === requested)
  return known ? String(requested) : (props.revisions[0]?.id ?? null)
})

const select = (id: string) => {
  void router.replace({ query: { ...route.query, tab: 'boqs', revision: id } })
}

const { data: boq, error } = await useAsyncData(
  () => `boq-${selectedId.value ?? 'none'}`,
  () => (selectedId.value ? detail(selectedId.value) : Promise.resolve(null)),
  { watch: [selectedId] },
)

const lineTotalOf = (item: BoqItem) =>
  calculateLineTotal(item.unitPrice, item.quantity)

const isWithdrawn = (item: BoqItem) =>
  item.current === null || item.current.status !== PRODUCT_STATUSES.PUBLISHED

const summary = computed(
  () => props.revisions.find((row) => row.id === selectedId.value) ?? null,
)
</script>

<template>
  <div class="tab-body">
    <p v-if="error" class="note status-bad">
      {{ errorMessage(toErrorCode(error)) }}
    </p>

    <div v-if="revisions.length" class="columns">
      <div class="list-column">
        <h2>Revisions</h2>
        <ul class="revisions">
          <li
            v-for="(row, index) in revisions"
            :key="row.id"
            class="revision"
            :class="{ 'is-selected': row.id === selectedId }"
          >
            <button
              type="button"
              class="revision-button"
              @click="select(row.id)"
            >
              <span class="revision-head">
                <span class="revision-name">Revision {{ row.revision }}</span>
                <span class="spacer" />
                <span v-if="index === 0" class="flag status-ok">Current</span>
              </span>
              <span class="muted revision-meta">
                {{ formatDate(row.createdAt) }} · {{ row.lineCount }}
                {{ row.lineCount === 1 ? 'line' : 'lines' }}
              </span>
              <span class="revision-total">
                {{ formatAmount(row.total) }} {{ currency }}
              </span>
            </button>
          </li>
        </ul>
      </div>

      <div v-if="boq && summary" class="detail-column">
        <div class="detail-header">
          <h2>Revision {{ boq.revision }}</h2>
          <span class="muted stamp">
            Generated {{ formatDateTime(boq.createdAt) }}
          </span>
          <div class="spacer" />
          <UiButton as-child>
            <a :href="exportUrl(boq.id, EXPORT_FORMATS.XLSX)">Export XLSX</a>
          </UiButton>
          <UiButton as-child>
            <a :href="exportUrl(boq.id, EXPORT_FORMATS.CSV)">Export CSV</a>
          </UiButton>
        </div>

        <table>
          <thead>
            <tr>
              <th class="index-column">#</th>
              <th>Item</th>
              <th class="sku-column">SKU</th>
              <th class="price-column">Unit price</th>
              <th class="qty-column">Qty</th>
              <th class="total-column">Line total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in boq.items" :key="item.id">
              <td class="num">{{ index + 1 }}</td>
              <td>
                <div class="ellip">{{ item.name }}</div>
                <span v-if="isWithdrawn(item)" class="flag status-warn">
                  Product since withdrawn
                </span>
              </td>
              <td>
                <code v-if="item.sku" class="ellip">{{ item.sku }}</code>
              </td>
              <td class="num">{{ formatAmount(item.unitPrice) }}</td>
              <td class="num">{{ item.quantity }}</td>
              <td class="num">{{ formatAmount(lineTotalOf(item)) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" class="foot">
                <span class="eyebrow">
                  Total · {{ boq.items.length }}
                  {{ boq.items.length === 1 ? 'line' : 'lines' }}
                </span>
              </td>
              <td class="foot foot-total">{{ formatAmount(boq.total) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <p v-else class="muted">
      No bill of quantities yet. Generate one once the products are set.
    </p>
  </div>
</template>

<style scoped>
.tab-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.columns {
  display: grid;
  grid-template-columns: minmax(0, 17rem) minmax(0, 1fr);
  gap: var(--space-12);
  align-items: start;
}

.list-column,
.detail-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  min-inline-size: 0;
}

.detail-column {
  gap: var(--space-7);
}

.revisions {
  display: flex;
  flex-direction: column;
}

.revision-button {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: var(--space-1);
  inline-size: 100%;
  padding: var(--space-5) var(--space-6);
  margin: 0 calc(-1 * var(--space-6));
  border: 0;
  border-inline-start: 2px solid transparent;
  font-size: var(--text-sm);
  font-weight: var(--weight-regular);
  line-height: var(--leading-normal);
  text-align: start;
}

.revision.is-selected .revision-button {
  background: var(--color-canvas);
}

.revision-head {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
}

.revision-name {
  font-weight: var(--weight-medium);
}

.spacer {
  flex-grow: 1;
}

.revision-meta {
  font-size: var(--text-2xs);
}

.revision-total {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.stamp {
  font-size: var(--text-xs);
}

.index-column {
  inline-size: 2.5rem;
  text-align: end;
}

.sku-column {
  inline-size: 11rem;
}

.price-column {
  inline-size: 7rem;
  text-align: end;
}

.qty-column {
  inline-size: 4rem;
  text-align: end;
}

.total-column {
  inline-size: 7.5rem;
  text-align: end;
}

.ellip {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
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

.foot {
  border-block-end: 0;
  padding-block-start: var(--space-6);
}

.foot-total {
  font-family: var(--font-mono);
  font-size: var(--text-md);
  font-variant-numeric: tabular-nums;
  text-align: end;
}
</style>
