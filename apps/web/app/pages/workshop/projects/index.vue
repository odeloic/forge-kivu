<script setup lang="ts">
definePageMeta({ access: 'authenticated', layout: 'workshop' })

const api = useApi()

const { data: projects } = await useAsyncData('projects', async () => {
  const res = await api.projects.$get()
  if (!res.ok) return []
  return res.json()
})
</script>

<template>
  <div>
    <h1>Projects</h1>
    <ul>
      <li v-for="project in projects" :key="project.id">
        <NuxtLink :to="`/workshop/projects/${project.id}/overview`">
          {{ project.name }}
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
