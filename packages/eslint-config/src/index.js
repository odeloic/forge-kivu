import prettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export const base = tseslint.config(...tseslint.configs.recommended, prettier)

export const node = tseslint.config({
  languageOptions: {
    globals: globals.node,
  },
})

export const vue = tseslint.config(
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  prettier,
)
