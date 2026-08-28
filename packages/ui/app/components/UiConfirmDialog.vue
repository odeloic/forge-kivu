<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

withDefaults(
  defineProps<{
    title: string
    description: string
    confirmLabel?: string
  }>(),
  { confirmLabel: 'Delete' },
)

const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay class="overlay" />
      <AlertDialogContent class="panel">
        <div class="heading">
          <AlertDialogTitle class="title">{{ title }}</AlertDialogTitle>
          <AlertDialogDescription class="muted description">
            {{ description }}
          </AlertDialogDescription>
        </div>

        <div class="actions">
          <AlertDialogCancel as-child>
            <UiButton>Cancel</UiButton>
          </AlertDialogCancel>
          <AlertDialogAction as-child>
            <UiButton variant="primary" @click="emit('confirm')">
              {{ confirmLabel }}
            </UiButton>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
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
  width: min(26rem, calc(100vw - var(--space-12)));
  padding: var(--space-10);
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
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.description {
  font-size: var(--text-xs);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-4);
}
</style>
