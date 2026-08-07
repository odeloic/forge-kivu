<script setup lang="ts">
import type { Todo } from '@forge-kivu/types'

defineProps<{ todo: Todo }>()
</script>

<template>
  <li>
    <span :class="{ completed: todo.completed }">{{ todo.title }}</span>
  </li>
</template>

<style scoped>
.completed {
  text-decoration: line-through;
}
</style>
