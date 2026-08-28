<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'reka-ui'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const props = withDefaults(
  defineProps<
    PrimitiveProps & {
      variant?: ButtonVariant
      type?: 'button' | 'submit'
    }
  >(),
  { as: 'button', variant: 'secondary', type: 'button' },
)
</script>

<template>
  <Primitive
    :as="props.as"
    :as-child="props.asChild"
    :type="props.as === 'button' ? props.type : undefined"
    class="button"
    :class="`button-${props.variant}`"
  >
    <slot />
  </Primitive>
</template>
