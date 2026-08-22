<script setup lang="ts">
definePageMeta({ access: 'authenticated', layout: 'workshop' })

const route = useRoute()
const id = computed(() => String(route.params.id))
</script>

<template>
  <div>
    <AppNav :entries="projectNav(id)" />
    <h1>Settings for project {{ id }}</h1>
  </div>
</template>
