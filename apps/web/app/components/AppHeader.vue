<script setup lang="ts">
const open = ref(false)
const header = useTemplateRef('header')
const restoreFocus = () => {
  header.value?.$el.querySelector('button')?.focus()
}
</script>

<template>
  <AppHeaderBar
    ref="header"
    :open="open"
    @toggle="open = !open"
    @home="open = false"
  />
  <AppMenu v-model:open="open" @closed="restoreFocus">
    <AppHeaderBar :open="true" @toggle="open = false" @home="open = false" />
  </AppMenu>
</template>
