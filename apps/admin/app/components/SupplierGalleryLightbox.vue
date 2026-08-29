<script setup lang="ts">
import type { AdminSupplierDetail } from '@forge-kivu/api-client'

const open = defineModel<boolean>('open', { default: false })
const index = defineModel<number>('index', { default: 0 })

const props = defineProps<{ items: AdminSupplierDetail['gallery'] }>()
const emit = defineEmits<{ edit: [id: string]; remove: [id: string] }>()

const current = computed(() => props.items[index.value] ?? null)

const step = (delta: number) => {
  if (props.items.length < 2) return
  index.value = (index.value + delta + props.items.length) % props.items.length
}

const onKeydown = (event: KeyboardEvent) => {
  const delta =
    event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
  if (delta === 0) return
  event.preventDefault()
  step(delta)
}

const edit = () => {
  if (!current.value) return
  const { id } = current.value
  open.value = false
  emit('edit', id)
}

const remove = () => {
  if (!current.value) return
  const { id } = current.value
  open.value = false
  emit('remove', id)
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="overlay" />
      <DialogContent
        v-if="current"
        class="frame"
        aria-describedby="undefined"
        @keydown="onKeydown"
      >
        <UiButton
          v-if="items.length > 1"
          class="arrow before"
          aria-label="Previous image"
          @click="step(-1)"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M10 3L5 8l5 5" />
          </svg>
        </UiButton>

        <UiButton
          v-if="items.length > 1"
          class="arrow after"
          aria-label="Next image"
          @click="step(1)"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M6 3l5 5-5 5" />
          </svg>
        </UiButton>

        <div class="bar">
          <code>{{ index + 1 }} / {{ items.length }}</code>
          <div class="spacer" />
          <span v-if="items.length > 1" class="faint keys">
            Arrow keys to move · Esc to close
          </span>
          <span v-else class="faint keys">Esc to close</span>
          <DialogClose as-child>
            <UiButton>Close</UiButton>
          </DialogClose>
        </div>

        <div class="stage">
          <img :src="current.imageUrl" :alt="current.altText ?? ''" />
        </div>

        <div class="footer">
          <div class="described">
            <DialogTitle class="alt">
              {{ current.altText ?? 'Needs alt text' }}
            </DialogTitle>
            <span v-if="current.caption" class="muted caption">
              {{ current.caption }}
            </span>
            <a
              v-if="current.linkUrl"
              class="link"
              :href="current.linkUrl"
              target="_blank"
              rel="noreferrer"
            >
              {{ current.linkUrl }}
            </a>
          </div>
          <div class="actions">
            <UiButton variant="ghost" @click="edit">Edit</UiButton>
            <UiButton variant="ghost" @click="remove">Remove</UiButton>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
}

.frame {
  position: fixed;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  inline-size: min(55rem, calc(100vw - 9rem));
  border: var(--border-hairline) solid var(--color-rule-strong);
  background: var(--color-paper);
  transform: translate(-50%, -50%);
}

.arrow {
  position: absolute;
  top: 50%;
  inline-size: 2.75rem;
  block-size: 2.75rem;
  padding: 0;
  border-color: var(--color-rule-strong);
  transform: translateY(-50%);
}

.arrow svg {
  inline-size: 1rem;
  block-size: 1rem;
}

.before {
  inset-inline-end: calc(100% + var(--space-7));
}

.after {
  inset-inline-start: calc(100% + var(--space-7));
}

.bar {
  display: flex;
  align-items: center;
  gap: var(--space-7);
  padding: var(--space-5) var(--space-7);
  border-block-end: var(--border-hairline) solid var(--color-rule);
}

.spacer {
  flex-grow: 1;
}

.keys {
  font-size: var(--text-2xs);
}

.faint {
  color: var(--color-faint);
}

.stage {
  display: flex;
  align-items: center;
  justify-content: center;
  block-size: 32.5rem;
  border-block-end: var(--border-hairline) solid var(--color-rule);
  background: var(--color-canvas);
}

.stage img {
  max-inline-size: 100%;
  max-block-size: 100%;
  object-fit: contain;
}

.footer {
  display: flex;
  align-items: flex-start;
  gap: var(--space-7);
  padding: var(--space-6) var(--space-7);
}

.described {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex-grow: 1;
  min-inline-size: 0;
}

.alt {
  font-size: var(--text-sm);
  font-weight: var(--weight-regular);
}

.caption {
  font-size: var(--text-xs);
}

.link {
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  gap: var(--space-1);
  margin: 0 calc(-1 * var(--space-4));
}
</style>
