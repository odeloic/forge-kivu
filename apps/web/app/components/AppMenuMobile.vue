<script setup lang="ts">
import type { MenuItem } from '../utils/menu'

const props = defineProps<{
  entries: readonly NavEntry[]
  selected: string | null
  items: MenuItem[]
  depth: number
  title: string
  error: boolean
  loading: boolean
}>()
const emit = defineEmits<{
  section: [path: string]
  pick: [item: MenuItem]
  back: []
  retry: []
}>()
const panel = useTemplateRef('panel')
const direction = ref('push')
const focus = () =>
  panel.value?.querySelector<HTMLButtonElement>('button')?.focus()
watch(
  () => [props.depth, props.selected],
  async ([depth], [previous]) => {
    if (depth === -1 && previous === -1) return
    direction.value = Number(depth) < Number(previous) ? 'back' : 'push'
    await nextTick()
    focus()
  },
)
const keydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowLeft' && props.depth >= 0) {
    event.preventDefault()
    emit('back')
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const buttons = Array.from(
      panel.value?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    )
    const index = buttons.indexOf(event.target as HTMLButtonElement)
    buttons[
      (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
        buttons.length
    ]?.focus()
  }
}
defineExpose({ focus })
</script>

<template>
  <div class="mobile-navigation">
    <Transition
      :name="direction"
      @before-leave="(element) => element.setAttribute('inert', '')"
    >
      <nav
        :key="depth < 0 ? 'sections' : `${selected}-${depth}`"
        ref="panel"
        class="panel"
        :aria-label="depth < 0 ? 'Public sections' : title"
        @keydown="keydown"
      >
        <template v-if="depth < 0">
          <button
            v-for="entry in entries"
            :key="entry.path"
            class="section"
            type="button"
            :aria-pressed="selected === entry.path"
            @click="emit('section', entry.path)"
          >
            {{ entry.label }}
          </button>
        </template>
        <template v-else>
          <button
            class="back"
            aria-label="Back"
            type="button"
            @click="emit('back')"
          >
            <span aria-hidden="true">←</span> Back<span class="title">{{
              title
            }}</span>
          </button>
          <div class="scroll" :aria-busy="loading">
            <div v-if="error" class="failure">
              <p role="status">Could not load</p>
              <button type="button" @click="emit('retry')">Retry</button>
            </div>
            <button
              v-for="item in items"
              :key="item.id"
              type="button"
              class="row"
              :aria-label="item.label"
              @click="emit('pick', item)"
              @keydown.right.prevent="
                item.children?.length && emit('pick', item)
              "
            >
              {{ item.label
              }}<span v-if="item.children?.length" aria-hidden="true">→</span>
            </button>
          </div>
        </template>
      </nav>
    </Transition>
  </div>
</template>

<style scoped>
.mobile-navigation {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.panel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-paper);
}
.section {
  flex: 1;
  justify-content: flex-end;
  padding-inline: var(--space-8);
  border-bottom: calc(2 * var(--border-hairline)) solid var(--color-rule-strong);
  color: var(--color-muted);
  font-size: 1.75rem;
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
}
.section[aria-pressed='true'] {
  color: var(--color-ink);
}
.back {
  flex-shrink: 0;
  justify-content: flex-start;
  gap: var(--space-8);
  min-height: 56px;
  padding: var(--space-8);
  border-bottom: var(--border-hairline) solid var(--color-rule-strong);
}
.title {
  margin-left: auto;
  text-align: right;
  overflow-wrap: anywhere;
}
.scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 72px;
  mask-image: linear-gradient(#000 calc(100% - 72px), transparent);
}
.row {
  width: 100%;
  min-height: 56px;
  justify-content: space-between;
  gap: var(--space-8);
  padding: var(--space-8);
  border-bottom: var(--border-hairline) solid var(--color-field-border);
  font-size: 0.9375rem;
  font-weight: var(--weight-regular);
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
}
.failure {
  padding: var(--space-8);
  color: var(--color-muted);
}
.push-enter-active,
.push-leave-active,
.back-enter-active,
.back-leave-active {
  transition: transform 360ms cubic-bezier(0.77, 0, 0.18, 1);
}
.push-enter-from,
.back-leave-to {
  transform: translateX(100%);
}
.push-leave-to,
.back-enter-from {
  transform: translateX(-100%);
}
@media (prefers-reduced-motion: reduce) {
  .push-enter-active,
  .push-leave-active,
  .back-enter-active,
  .back-leave-active {
    transition: none;
  }
}
</style>
