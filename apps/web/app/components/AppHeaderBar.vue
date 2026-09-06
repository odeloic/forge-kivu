<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits<{ toggle: []; home: [] }>()
</script>

<template>
  <header class="header">
    <NuxtLink class="wordmark" to="/" @click="emit('home')"
      >Forge Kivu</NuxtLink
    >
    <button
      type="button"
      :aria-label="open ? 'Close menu' : 'Open menu'"
      :aria-expanded="open"
      class="toggle"
      @click="emit('toggle')"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="square"
        aria-hidden="true"
      >
        <path :d="open ? 'M5 5l14 14M19 5L5 19' : 'M3 6h18M3 12h18M3 18h18'" />
      </svg>
    </button>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding-inline: var(--space-12);
  background: var(--color-paper);
  border-bottom: calc(2 * var(--border-hairline)) solid var(--color-rule-strong);
}
.wordmark {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-heading);
  text-transform: uppercase;
  text-decoration: none;
  color: var(--color-ink);
}
.toggle {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  cursor: pointer;
}
</style>
