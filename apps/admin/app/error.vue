<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const message = computed(() => errorMessage(fromNuxtError(props.error)))
</script>

<template>
  <main>
    <h1>{{ error.statusCode }}</h1>
    <p>{{ message }}</p>
    <button type="button" @click="clearError({ redirect: '/' })">Home</button>
  </main>
</template>
