<script setup lang="ts">
definePageMeta({ access: 'guest' })

const route = useRoute()
const { login } = useSession()

const email = ref('')
const password = ref('')
const error = ref<ErrorCode | null>(null)

const submit = async () => {
  error.value = null
  try {
    await login(email.value, password.value)
    const redirect = route.query.redirect
    await navigateTo(typeof redirect === 'string' ? redirect : '/')
  } catch (cause) {
    error.value = toErrorCode(cause)
  }
}
</script>

<template>
  <div>
    <h1>Log in</h1>
    <form @submit.prevent="submit">
      <input v-model="email" type="email" placeholder="Email" />
      <input v-model="password" type="password" placeholder="Password" />
      <button type="submit">Log in</button>
    </form>
    <p v-if="error">{{ errorMessage(error) }}</p>
  </div>
</template>
