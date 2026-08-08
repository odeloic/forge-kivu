import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { createTodoSchema } from '@forge-kivu/types'

import { todos } from '@/todos'

export const app = new Hono()
  .use(cors())
  .get('/todos', (c) => c.json(todos.list()))
  .post('/todos', zValidator('json', createTodoSchema), (c) =>
    c.json(todos.create(c.req.valid('json')), 201),
  )

export type AppType = typeof app

export default {
  port: 3001,
  fetch: app.fetch,
}
