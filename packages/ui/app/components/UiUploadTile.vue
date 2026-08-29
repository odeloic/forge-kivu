<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    status: string
    tone?: 'neutral' | 'ok' | 'error'
    progress?: number | null
    thumbnail?: string | null
  }>(),
  { tone: 'neutral', progress: null, thumbnail: null },
)

const percent = computed(() =>
  props.progress === null ? null : Math.round(props.progress * 100),
)
</script>

<template>
  <li class="tile">
    <span class="thumb">
      <img v-if="thumbnail" :src="thumbnail" :alt="label" />
    </span>

    <span class="body">
      <span class="label">{{ label }}</span>
      <span class="status" :class="`tone-${tone}`">{{ status }}</span>
      <span v-if="percent !== null" class="track">
        <span class="fill" :style="{ inlineSize: `${percent}%` }" />
      </span>
    </span>

    <span class="actions">
      <slot name="actions" />
    </span>
  </li>
</template>

<style scoped>
.tile {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-5) 0;
  border-block-end: var(--border-hairline) solid var(--color-rule);
}

.thumb {
  flex: none;
  overflow: hidden;
  inline-size: 2.75rem;
  block-size: 2.75rem;
  border: var(--border-hairline) solid var(--color-rule);
  background: var(--color-canvas);
}

.thumb img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

.body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-2);
  min-inline-size: 0;
}

.label {
  overflow: hidden;
  font-size: var(--text-sm);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.status {
  font-size: var(--text-2xs);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.tone-neutral {
  color: var(--color-status-neutral);
}

.tone-ok {
  color: var(--color-status-ok);
}

.tone-error {
  color: var(--color-status-bad);
}

.track {
  block-size: 2px;
  background: var(--color-rule);
}

.fill {
  display: block;
  block-size: 100%;
  background: var(--color-ink);
  transition: inline-size 120ms linear;
}

.actions {
  display: flex;
  flex: none;
  gap: var(--space-4);
}
</style>
