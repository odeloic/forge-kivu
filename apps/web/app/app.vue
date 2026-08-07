<script setup lang="ts">
const api = useApi()

const { data: todos, refresh } = await useAsyncData('todos', async () => {
  const res = await api.todos.$get()
  return res.json()
})

const title = ref('')

const addTodo = async () => {
  if (!title.value.trim()) return
  await api.todos.$post({ json: { title: title.value.trim() } })
  title.value = ''
  await refresh()
}
</script>

<template>
  <main>
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
