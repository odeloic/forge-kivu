<script setup lang="ts">
definePageMeta({ access: 'admin-only', layout: 'admin' })

const api = useApi()

const { data: suppliers } = await useAsyncData('admin-suppliers', async () => {
  const res = await api.admin.suppliers.$get()
  if (!res.ok) return []
  return res.json()
})
</script>

<template>
  <div>
    <h1>Admin</h1>
    <ul>
      <li v-for="supplier in suppliers" :key="supplier.id">
        {{ supplier.name }}
      </li>
    </ul>
  </div>
</template>
