import { z } from 'zod'

export const todoSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  completed: z.boolean(),
})

export const createTodoSchema = todoSchema.pick({ title: true })

export type Todo = z.infer<typeof todoSchema>
export type CreateTodo = z.infer<typeof createTodoSchema>
