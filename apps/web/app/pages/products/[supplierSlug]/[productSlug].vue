<script setup lang="ts">
definePageMeta({ access: 'public' })

const route = useRoute()
</script>

<template>
  <h1>{{ route.params.supplierSlug }} / {{ route.params.productSlug }}</h1>
</template>
