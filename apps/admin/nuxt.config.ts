export default defineNuxtConfig({
  extends: ['@forge-kivu/nuxt-base', '@forge-kivu/ui'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  routeRules: {
    '/': { redirect: '/products' },
  },
})
