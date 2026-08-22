import { base, node, vue } from '@forge-kivu/eslint-config'

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/coverage/**',
    ],
  },
  ...base,
  ...node,
  ...vue,
  {
    files: [
      'apps/web/app/{app,error}.vue',
      'apps/web/app/{pages,layouts}/**/*.vue',
    ],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
]
