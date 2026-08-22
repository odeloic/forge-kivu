<script setup lang="ts">
const { user, isAuthenticated, logout } = useSession()
</script>

<template>
  <p v-if="isAuthenticated">
    {{ user?.email }} ({{ user?.role }})
    <button type="button" @click="logout()">Log out</button>
  </p>
  <p v-else>
    <NuxtLink to="/login">Log in</NuxtLink>
  </p>
</template>
