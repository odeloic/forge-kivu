<script setup lang="ts">
import { useDropZone, useFileDialog } from '@vueuse/core'

const props = withDefaults(
  defineProps<{ accept?: string; multiple?: boolean; disabled?: boolean }>(),
  { accept: 'image/*', multiple: true, disabled: false },
)

const emit = defineEmits<{ files: [File[]] }>()

const zone = useTemplateRef<HTMLElement>('zone')
const overCount = ref(0)

const dialog = useFileDialog({
  accept: props.accept,
  multiple: props.multiple,
  reset: true,
})

dialog.onChange((list) => {
  if (list && list.length > 0) emit('files', Array.from(list))
})

const { isOverDropZone } = useDropZone(zone, {
  multiple: props.multiple,
  preventDefaultForUnhandled: false,
  onOver: (_files, event) => {
    overCount.value = event.dataTransfer?.items.length ?? 0
  },
  onLeave: () => {
    overCount.value = 0
  },
  onDrop: (files) => {
    overCount.value = 0
    if (files && files.length > 0) emit('files', files)
  },
})

const choose = () => {
  if (!props.disabled) dialog.open()
}
</script>

<template>
  <div
    ref="zone"
    class="zone"
    :class="{ over: isOverDropZone, disabled }"
    :aria-disabled="disabled"
  >
    <slot :over="isOverDropZone" :count="overCount" :choose="choose" />
  </div>
</template>

<style scoped>
.zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-5);
  padding: var(--space-11) var(--space-9);
  border: var(--border-hairline) dashed var(--color-control-border);
  background: var(--color-paper);
  text-align: center;
  transition: background 120ms ease;
}

.zone.over {
  border-color: var(--color-rule-strong);
  border-style: solid;
  background: var(--color-canvas);
}

.zone.disabled {
  opacity: 0.5;
}
</style>
