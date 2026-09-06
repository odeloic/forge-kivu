<script setup lang="ts">
import {
  type LineView,
  lineTotalOf,
  quantityValid,
  spaceLabelOf,
  unitSuffix,
} from '../utils/lines'

const props = defineProps<{
  line: LineView
  workingCopy: boolean
  pending: boolean
}>()

const emit = defineEmits<{
  quantity: [quantity: number]
  remove: []
}>()

const draft = ref(String(props.line.quantity))

watch(
  () => props.line.quantity,
  (quantity) => {
    draft.value = String(quantity)
  },
)

const commit = () => {
  if (!quantityValid(draft.value)) return
  const next = Number(draft.value)
  if (next !== props.line.quantity) emit('quantity', next)
}

const reset = () => {
  draft.value = String(props.line.quantity)
}

defineExpose({ reset })
</script>

<template>
  <article class="card" :class="{ withdrawn: line.withdrawn }">
    <header class="head">
      <span class="eyebrow ellip supplier">{{ line.supplierName }}</span>
      <span
        class="eyebrow space"
        :class="{ unassigned: line.spaceName === null }"
      >
        {{ spaceLabelOf(line) }}
      </span>
      <UiButton
        v-if="workingCopy"
        variant="ghost"
        class="remove"
        :disabled="pending"
        :aria-label="`Remove ${line.name}`"
        @click="emit('remove')"
      >
        ×
      </UiButton>
    </header>

    <div class="figure">
      <img
        v-if="line.imageUrl"
        :src="line.imageUrl"
        :alt="line.name"
        loading="lazy"
      />
      <span v-else class="eyebrow">No image</span>
    </div>

    <div class="body">
      <div class="named">
        <span class="ellip name">{{ line.name }}</span>
        <code v-if="line.caption" class="ellip">{{ line.caption }}</code>
        <span v-if="line.withdrawn" class="flag status-bad">
          No longer available
        </span>
        <span v-else-if="line.price === null" class="flag status-warn">
          No price yet
        </span>
      </div>
      <span v-if="line.price === null" class="muted price">—</span>
      <span v-else class="price">
        {{ formatAmount(line.price)
        }}<span v-if="unitSuffix(line.unit)" class="muted suffix">{{
          unitSuffix(line.unit)
        }}</span>
      </span>
    </div>

    <footer class="foot">
      <ProjectQuantityField
        v-if="workingCopy"
        v-model="draft"
        :unit="line.unit"
        :field-id="`card-qty-${line.key}`"
        label-hidden
        steppers="always"
        :invalid="!quantityValid(draft)"
        class="quantity"
        @commit="commit"
      />
      <div v-else class="quantity frozen">
        <span class="eyebrow">Qty</span>
        <span class="mono">
          {{ line.quantity }}<span class="muted"> {{ line.unit }}</span>
        </span>
      </div>
      <span class="spacer" />
      <span class="eyebrow line-label">Line</span>
      <span v-if="line.price === null" class="mono muted total">—</span>
      <span v-else class="mono total">{{
        formatAmount(lineTotalOf(line))
      }}</span>
    </footer>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
  border: var(--border-hairline) solid var(--color-rule);
  background: var(--color-paper);
}

.withdrawn {
  border-color: var(--color-status-bad);
}

.head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
}

.supplier {
  flex: 1 1 auto;
  min-inline-size: 0;
}

.space {
  flex: none;
  color: var(--color-muted);
  white-space: nowrap;
}

.space.unassigned {
  color: var(--color-faint);
}

.remove {
  margin-block: calc(-1 * var(--space-2));
  margin-inline-end: calc(-1 * var(--space-3));
  padding: 0 var(--space-3);
}

.figure {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  min-block-size: 9.25rem;
  padding: var(--space-4) var(--space-8) var(--space-8);
}

.figure img {
  max-inline-size: 100%;
  max-block-size: 9.25rem;
  object-fit: contain;
}

.withdrawn .figure {
  opacity: 0.45;
}

.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  border-block-start: var(--border-hairline) solid var(--color-rule);
}

.named {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
  padding: var(--space-4) var(--space-5);
}

.name {
  font-size: var(--text-sm);
}

.flag {
  margin-block-start: var(--space-1);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.price {
  padding: var(--space-4) var(--space-5);
  border-inline-start: var(--border-hairline) solid var(--color-rule);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.suffix {
  font-weight: var(--weight-regular);
}

.foot {
  display: flex;
  align-items: center;
  border-block-start: var(--border-hairline) solid var(--color-rule);
}

.quantity {
  border-inline-end: var(--border-hairline) solid var(--color-rule);
}

.quantity.frozen {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  font-size: var(--text-xs);
}

.spacer {
  flex-grow: 1;
}

.line-label {
  padding-inline-end: var(--space-4);
}

.total {
  padding: var(--space-4) var(--space-5);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.ellip {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
