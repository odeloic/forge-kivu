<script setup lang="ts">
const api = useApi()
const { user, login, signup, logout } = useAuth()

const { data: todos, refresh } = await useAsyncData('todos', async () => {
  const res = await api.todos.$get()
  return res.json()
})

const title = ref('')
const email = ref('')
const password = ref('')
const authError = ref('')

const addTodo = async () => {
  if (!title.value.trim()) return
  await api.todos.$post({ json: { title: title.value.trim() } })
  title.value = ''
  await refresh()
}

const submit = async (
  action: (email: string, password: string) => Promise<void>,
) => {
  authError.value = ''
  try {
    await action(email.value, password.value)
    email.value = ''
    password.value = ''
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Request failed'
  }
}
</script>

<template>
  <main>
    <section>
      <p v-if="user">
        Signed in as {{ user.email }} ({{ user.role }})
        <button type="button" @click="logout()">Log out</button>
      </p>
      <form v-else @submit.prevent="submit(login)">
        <input v-model="email" type="email" placeholder="Email" />
        <input v-model="password" type="password" placeholder="Password" />
        <button type="submit">Log in</button>
        <button type="button" @click="submit(signup)">Sign up</button>
      </form>
      <p v-if="authError">{{ authError }}</p>
    </section>

    <h1>Todos</h1>
    <form @submit.prevent="addTodo">
      <input v-model="title" placeholder="New todo" />
      <button type="submit">Add</button>
    </form>
    <ul>
      <TodoItem v-for="todo in todos" :key="todo.id" :todo="todo" />
    </ul>
  </main>
</template>
