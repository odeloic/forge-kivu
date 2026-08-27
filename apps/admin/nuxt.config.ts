export default defineNuxtConfig({
  extends: ['@forge-kivu/nuxt-base'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['reka-ui/nuxt'],
  css: [
    '~/assets/css/reset.css',
    '~/assets/css/tokens.css',
    '~/assets/css/base.css',
  ],
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap',
        },
      ],
    },
  },
  routeRules: {
    '/': { redirect: '/products' },
  },
})
