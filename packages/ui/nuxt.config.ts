import { fileURLToPath } from 'node:url'

const stylesheet = (file: string) =>
  fileURLToPath(new URL(`./app/assets/css/${file}`, import.meta.url))

export default defineNuxtConfig({
  $meta: { name: 'ui' },
  compatibilityDate: '2025-07-15',
  modules: ['reka-ui/nuxt'],
  css: [
    stylesheet('reset.css'),
    stylesheet('tokens.css'),
    stylesheet('base.css'),
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
})
