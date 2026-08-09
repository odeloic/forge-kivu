import { app } from './app'

export { app }
export type { AppType } from './app'

export default {
  port: 3001,
  fetch: app.fetch,
}
