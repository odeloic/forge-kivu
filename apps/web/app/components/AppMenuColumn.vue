<script setup lang="ts">
import type { MenuItem } from '../utils/menu'

defineProps<{
  items: MenuItem[]
  active?: string
  error?: boolean
  label: string
}>()
const emit = defineEmits<{
  pick: [item: MenuItem]
  move: [direction: 'left' | 'right', item: MenuItem]
}>()
const list = useTemplateRef('list')
const focus = (id?: string) => {
  const buttons = list.value?.querySelectorAll<HTMLButtonElement>('button')
  const target =
    Array.from(buttons ?? []).find((button) => button.dataset.id === id) ??
    buttons?.[0]
  target?.focus()
}
const keydown = (event: KeyboardEvent, item: MenuItem) => {
  const buttons = Array.from(
    list.value?.querySelectorAll<HTMLButtonElement>('button') ?? [],
  )
  const index = buttons.indexOf(event.target as HTMLButtonElement)
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    buttons[
      (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
        buttons.length
    ]?.focus()
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault()
    emit('move', event.key === 'ArrowRight' ? 'right' : 'left', item)
  }
}
defineExpose({ focus })
</script>

<template>
  <section class="column" :aria-label="label" data-menu-column>
    <div ref="list" class="list">
      <p v-if="error" class="error" role="status">Could not load</p>
      <button
        v-for="(item, index) in items"
        :key="item.id"
        type="button"
        class="row"
        :class="{ active: active === item.id }"
        :data-id="item.id"
        :aria-expanded="item.children?.length ? active === item.id : undefined"
        :style="{ animationDelay: `${index * 35}ms` }"
        @click="emit('pick', item)"
        @keydown="keydown($event, item)"
      >
        {{ item.label }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.column {
  flex: 0 0 auto;
  width: 360px;
  height: 100%;
  overflow: hidden;
  border-right: calc(2 * var(--border-hairline)) solid var(--color-rule-strong);
}
.list {
  width: 360px;
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 72px;
  mask-image: linear-gradient(#000 calc(100% - 72px), transparent);
}
.row {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  width: 100%;
  min-height: 56px;
  padding: var(--space-4) var(--space-5) var(--space-4) var(--space-8);
  border: 0;
  border-bottom: var(--border-hairline) solid var(--color-field-border);
  background: transparent;
  color: var(--color-muted);
  font-weight: var(--weight-regular);
  font-size: 0.9375rem;
  letter-spacing: 0.04em;
  line-height: var(--leading-tight);
  text-transform: uppercase;
  text-align: right;
  cursor: pointer;
  animation: reveal 260ms both;
}
.row.active {
  font-weight: var(--weight-semibold);
  color: var(--color-ink);
}
.row:hover {
  color: var(--color-ink);
}
.row:focus-visible {
  outline: var(--focus-width-strong) solid var(--color-accent);
  outline-offset: calc(-1 * var(--focus-width-strong));
}
.error {
  padding: var(--space-8);
  color: var(--color-muted);
}
@keyframes reveal {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .row {
    animation: none;
  }
}
</style>
