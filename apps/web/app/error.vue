<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const message = computed(() => errorMessage(nuxtWebErrorCode(props.error)))
</script>

<template>
  <div>
    <h1>{{ error.statusCode }}</h1>
    <p>{{ message }}</p>
    <button type="button" @click="clearError({ redirect: '/' })">Home</button>
  </div>
</template>
