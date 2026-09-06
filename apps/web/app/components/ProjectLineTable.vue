<script setup lang="ts">
import {
  ATTRIBUTE_VALUE_TYPES,
  type BoqColumn,
  type BoqLineGroup,
  type BoqSortField,
  type BoqViewQuery,
} from '@forge-kivu/types'

import {
  type LineView,
  lineTotalOf,
  quantityValid,
  SORTABLE_COLUMNS,
  spaceLabelOf,
} from '../utils/lines'

const props = defineProps<{
  groups: BoqLineGroup<LineView>[]
  columns: BoqColumn[]
  view: BoqViewQuery
  sourceTotal: number
  sourceCount: number
  workingCopy: boolean
  pending: boolean
}>()

const emit = defineEmits<{
  sort: [field: BoqSortField]
  quantity: [line: LineView, quantity: number]
  remove: [line: LineView]
}>()

const drafts = reactive(new Map<string, string>())

const draftOf = (line: LineView): string =>
  drafts.get(line.key) ?? String(line.quantity)

const setDraft = (line: LineView, value: string) => {
  drafts.set(line.key, value)
}

const commit = (line: LineView) => {
  const draft = drafts.get(line.key)
  if (draft === undefined || !quantityValid(draft)) return
  const next = Number(draft)
  if (next === line.quantity) {
    drafts.delete(line.key)
    return
  }
  emit('quantity', line, next)
}

const resetDrafts = () => drafts.clear()

watch(
  () => props.groups,
  () => resetDrafts(),
)

const visibleCount = computed(() =>
  props.groups.reduce((count, group) => count + group.lines.length, 0),
)

const visibleTotal = computed(() =>
  props.groups.reduce((total, group) => total + group.subtotal, 0),
)

const shareOf = (line: LineView) =>
  props.sourceTotal === 0 ? 0 : lineTotalOf(line) / props.sourceTotal

const span = computed(
  () => props.columns.length + 3 + (props.workingCopy ? 1 : 0),
)

const beforeTotal = computed(() => 2 + props.columns.indexOf('lineTotal'))

const afterTotal = computed(() => span.value - beforeTotal.value - 1)

const sortState = (column: BoqColumn): 'asc' | 'desc' | null => {
  const field = SORTABLE_COLUMNS[column]
  if (!field || props.view.sort.field !== field) return null
  return props.view.sort.direction
}

const isColor = (type: string) => type === ATTRIBUTE_VALUE_TYPES.COLOR

const numeric = new Set<BoqColumn>(['unitPrice', 'quantity', 'lineTotal'])

const numbers = computed(() => {
  const byKey = new Map<string, number>()
  let index = 0
  for (const group of props.groups) {
    for (const line of group.lines) {
      index += 1
      byKey.set(line.key, index)
    }
  }
  return byKey
})

defineExpose({ resetDrafts })
</script>

<template>
  <div class="scroll">
    <table :class="{ working: workingCopy }">
      <thead>
        <tr>
          <th class="index-column">#</th>
          <th class="image-column">Image</th>
          <th
            v-for="column in columns"
            :key="column"
            :class="[`col-${column}`, { numeric: numeric.has(column) }]"
            :aria-sort="
              sortState(column) === 'asc'
                ? 'ascending'
                : sortState(column) === 'desc'
                  ? 'descending'
                  : undefined
            "
          >
            <button
              v-if="SORTABLE_COLUMNS[column]"
              type="button"
              class="sort"
              :class="{ active: sortState(column) !== null }"
              @click="emit('sort', SORTABLE_COLUMNS[column] as BoqSortField)"
            >
              {{ BOQ_COLUMN_LABELS[column] }}
              <span v-if="sortState(column) === 'asc'" aria-hidden="true"
                >↑</span
              >
              <span v-else-if="sortState(column) === 'desc'" aria-hidden="true">
                ↓
              </span>
            </button>
            <template v-else>{{ BOQ_COLUMN_LABELS[column] }}</template>
          </th>
          <th class="share-column">Share</th>
          <th v-if="workingCopy" class="remove-column" />
        </tr>
      </thead>
      <tbody>
        <template v-for="group in groups" :key="group.key">
          <tr v-if="view.groupBy !== null">
            <td :colspan="span" class="group-cell">
              <span class="group-head">
                <span class="eyebrow">
                  {{ group.label }} · {{ group.lines.length }}
                  {{ group.lines.length === 1 ? 'line' : 'lines' }}
                </span>
                <span class="spacer" />
                <span class="num">{{ formatAmount(group.subtotal) }}</span>
              </span>
            </td>
          </tr>
          <tr v-for="line in group.lines" :key="line.key">
            <td class="num muted">{{ numbers.get(line.key) }}</td>
            <td>
              <span class="thumb" :class="{ placeholder: !line.imageUrl }">
                <img
                  v-if="line.imageUrl"
                  :src="line.imageUrl"
                  :alt="line.name"
                />
              </span>
            </td>
            <template v-for="column in columns" :key="column">
              <td v-if="column === 'name'">
                <div class="named">
                  <span class="ellip">{{ line.name }}</span>
                  <code v-if="line.caption" class="ellip">
                    {{ line.caption }}
                  </code>
                  <span v-if="line.withdrawn" class="flag status-bad">
                    No longer available
                  </span>
                  <span
                    v-else-if="line.price === null"
                    class="flag status-warn"
                  >
                    No price yet
                  </span>
                </div>
              </td>
              <td v-else-if="column === 'sku'">
                <code v-if="line.sku" class="ellip">{{ line.sku }}</code>
              </td>
              <td v-else-if="column === 'supplier'">
                <div class="ellip">{{ line.supplierName }}</div>
              </td>
              <td v-else-if="column === 'category'">
                <div class="ellip">{{ line.categoryName }}</div>
              </td>
              <td v-else-if="column === 'space'">
                <div class="ellip">{{ spaceLabelOf(line) }}</div>
              </td>
              <td v-else-if="column === 'unit'" class="muted unit">
                {{ line.unit }}
              </td>
              <td v-else-if="column === 'options'">
                <ul class="options">
                  <li
                    v-for="option in line.options"
                    :key="option.name"
                    class="option"
                  >
                    <template v-if="isColor(option.type)">
                      <span
                        class="swatch"
                        :style="{ background: option.hex ?? 'transparent' }"
                      />
                      {{ option.value }}
                    </template>
                    <template v-else>
                      {{ option.name }}: {{ option.value }}
                    </template>
                  </li>
                </ul>
              </td>
              <td v-else-if="column === 'unitPrice'" class="num">
                <span v-if="line.price === null" class="muted">—</span>
                <template v-else>{{ formatAmount(line.price) }}</template>
              </td>
              <td v-else-if="column === 'quantity'">
                <ProjectQuantityField
                  v-if="workingCopy"
                  :model-value="draftOf(line)"
                  :unit="line.unit"
                  :field-id="`qty-${line.key}`"
                  label-hidden
                  steppers="always"
                  :invalid="!quantityValid(draftOf(line))"
                  @update:model-value="setDraft(line, $event)"
                  @commit="commit(line)"
                />
                <span v-else class="num">{{ line.quantity }}</span>
              </td>
              <td v-else-if="column === 'lineTotal'" class="num">
                <span v-if="line.price === null" class="muted">—</span>
                <template v-else>{{
                  formatAmount(lineTotalOf(line))
                }}</template>
              </td>
            </template>
            <td>
              <span class="share">
                <span class="share-track">
                  <span
                    class="share-fill"
                    :style="{ inlineSize: `${shareOf(line) * 100}%` }"
                  />
                </span>
                <span class="muted share-value">
                  {{ formatShare(shareOf(line)) }}
                </span>
              </span>
            </td>
            <td v-if="workingCopy">
              <div class="actions">
                <UiButton
                  variant="ghost"
                  :disabled="pending"
                  :aria-label="`Remove ${line.name}`"
                  @click="emit('remove', line)"
                >
                  ×
                </UiButton>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
      <tfoot>
        <tr>
          <td :colspan="beforeTotal" class="foot">
            <span class="eyebrow">
              Total · {{ visibleCount }}
              {{ visibleCount === 1 ? 'line' : 'lines' }}
              <template v-if="visibleCount !== sourceCount">
                of {{ sourceCount }}
              </template>
            </span>
          </td>
          <td class="foot foot-total">{{ formatAmount(visibleTotal) }}</td>
          <td v-if="afterTotal > 0" :colspan="afterTotal" class="foot" />
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<style scoped>
.scroll {
  overflow-x: auto;
}

table {
  min-inline-size: 100%;
}

.index-column {
  inline-size: 2.25rem;
  text-align: end;
}

.image-column {
  inline-size: 4.25rem;
}

.share-column {
  inline-size: 6.75rem;
}

.remove-column {
  inline-size: 2.5rem;
}

.col-options {
  inline-size: 7.375rem;
}

.col-supplier {
  inline-size: 9.75rem;
}

.col-category,
.col-space {
  inline-size: 6rem;
}

.col-sku {
  inline-size: 8rem;
}

.col-unit {
  inline-size: 3.25rem;
}

.col-unitPrice {
  inline-size: 6.25rem;
}

.col-quantity {
  inline-size: 3.5rem;
}

.working .col-quantity {
  inline-size: 12rem;
}

.col-lineTotal {
  inline-size: 6.75rem;
}

th.numeric {
  text-align: end;
}

.sort {
  display: inline-flex;
  gap: var(--space-2);
  padding: 0;
  border: 0;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
}

.sort:hover {
  text-decoration: underline;
  text-underline-offset: 0.125rem;
}

.sort.active {
  color: var(--color-ink);
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

.spacer {
  flex-grow: 1;
}

.thumb {
  display: block;
  overflow: hidden;
  inline-size: 2.75rem;
  block-size: 2.25rem;
  border: var(--border-hairline) solid var(--color-rule);
  background: var(--color-canvas);
}

.thumb.placeholder {
  background: repeating-linear-gradient(
    -45deg,
    var(--color-canvas),
    var(--color-canvas) 4px,
    var(--color-rule) 4px,
    var(--color-rule) 5px
  );
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

.flag {
  margin-block-start: var(--space-1);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.options {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-xs);
}

.option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
}

.swatch {
  display: inline-block;
  inline-size: 0.75rem;
  block-size: 0.75rem;
  border: var(--border-hairline) solid var(--color-control-border);
}

.num {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.unit {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
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
