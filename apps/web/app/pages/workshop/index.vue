<script setup lang="ts">
definePageMeta({ access: 'authenticated', layout: 'workshop' })

const { user } = useSession()
</script>

<template>
  <h1>Workshop for {{ user?.email }}</h1>
</template>
