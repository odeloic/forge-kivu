import prettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const VUE_FILES = ['**/*.vue']

export const base = tseslint.config(...tseslint.configs.recommended, prettier, {
  rules: {
    '@typescript-eslint/no-explicit-any': [
      'error',
      { fixToUnknown: true, ignoreRestArgs: false },
    ],
  },
})

export const node = tseslint.config({
  languageOptions: {
    globals: globals.node,
  },
})

export const vue = tseslint.config(
  ...pluginVue.configs['flat/recommended'].map((config) => ({
    ...config,
    files: config.files ?? VUE_FILES,
  })),
  {
    files: VUE_FILES,
    ...prettier,
  },
  {
    files: VUE_FILES,
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      'vue/order-in-components': 'error',
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/define-emits-declaration': ['error', 'type-based'],
      'vue/require-typed-object-prop': 'error',
      'vue/require-prop-types': 'error',
      'vue/require-explicit-emits': 'error',
      'vue/require-typed-ref': 'error',
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      'vue/enforce-style-attribute': ['error', { allow: ['scoped'] }],
      'vue/define-macros-order': [
        'error',
        {
          order: [
            'defineOptions',
            'defineModel',
            'defineProps',
            'defineEmits',
            'defineSlots',
          ],
          defineExposeLast: true,
        },
      ],
    },
  },
)
