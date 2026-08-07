import type { CreateTodo, Todo } from '@forge-kivu/types'

const store = new Map<string, Todo>()

export const todos = {
  list: (): Todo[] => [...store.values()],
  create: (input: CreateTodo): Todo => {
    const todo: Todo = { id: crypto.randomUUID(), completed: false, ...input }
    store.set(todo.id, todo)
    return todo
  },
}
