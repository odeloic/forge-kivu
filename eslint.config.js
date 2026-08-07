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
]
