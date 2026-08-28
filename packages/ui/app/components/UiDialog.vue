<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

defineProps<{ title: string; description?: string }>()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="overlay" />
      <DialogContent
        class="panel"
        :aria-describedby="description ? undefined : 'undefined'"
      >
        <div class="heading">
          <DialogTitle class="title">{{ title }}</DialogTitle>
          <DialogDescription v-if="description" class="muted description">
            {{ description }}
          </DialogDescription>
        </div>

        <slot />
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

.panel {
  position: fixed;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
  width: min(28rem, calc(100vw - var(--space-12)));
  padding: var(--space-10) var(--space-10) var(--space-11);
  border: var(--border-hairline) solid var(--color-rule-strong);
  background: var(--color-paper);
  transform: translate(-50%, -50%);
}

.heading {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.title {
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-tight);
}

.description {
  font-size: var(--text-xs);
}
</style>
