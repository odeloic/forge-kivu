<script setup lang="ts">
const props = defineProps<{ entries: readonly NavEntry[] }>()

const router = useRouter()
const user = useSessionState()

const visible = computed(() =>
  props.entries.filter((entry) =>
    canAccess(resolveAccess(router.resolve(entry.path)), user.value),
  ),
)
</script>

<template>
  <nav>
    <ul>
      <li v-for="entry in visible" :key="entry.path">
        <NuxtLink :to="entry.path">{{ entry.label }}</NuxtLink>
      </li>
    </ul>
  </nav>
</template>
