const apiOrigin = process.env.NUXT_API_BASE ?? 'http://localhost:3001'

export default defineNuxtConfig({
  $meta: { name: 'base' },
  compatibilityDate: '2025-07-15',
  runtimeConfig: {
    apiBase: apiOrigin,
    public: {
      apiBase: '/api',
    },
  },
  routeRules: {
    '/api/**': { proxy: { to: `${apiOrigin}/**` } },
  },
})
