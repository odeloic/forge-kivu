<script setup lang="ts">
definePageMeta({ access: 'public' })

const route = useRoute()
</script>

<template>
  <h1>Supplier {{ route.params.slug }}</h1>
</template>
