<script setup lang="ts">
import type { BoqLineGroup } from '@forge-kivu/types'

import type { LineView } from '../utils/lines'

defineProps<{
  groups: BoqLineGroup<LineView>[]
  grouped: boolean
  workingCopy: boolean
  pending: boolean
}>()

const emit = defineEmits<{
  quantity: [line: LineView, quantity: number]
  remove: [line: LineView]
}>()
</script>

<template>
  <div class="sections">
    <section v-for="group in groups" :key="group.key" class="section">
      <header v-if="grouped" class="heading">
        <span class="eyebrow">
          {{ group.label }} · {{ group.lines.length }}
          {{ group.lines.length === 1 ? 'line' : 'lines' }}
        </span>
        <span class="spacer" />
        <span class="num">{{ formatAmount(group.subtotal) }}</span>
      </header>
      <ul class="grid">
        <li v-for="line in group.lines" :key="line.key">
          <ProjectLineCard
            :line="line"
            :working-copy="workingCopy"
            :pending="pending"
            @quantity="emit('quantity', line, $event)"
            @remove="emit('remove', line)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.heading {
  display: flex;
  align-items: baseline;
  gap: var(--space-6);
  padding-block-end: var(--space-2);
  border-block-end: var(--border-hairline) solid var(--color-rule-strong);
}

.spacer {
  flex-grow: 1;
}

.num {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--space-7);
}
</style>
