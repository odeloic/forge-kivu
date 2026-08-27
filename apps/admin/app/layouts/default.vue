<script setup lang="ts">
const { user, logout } = useSession()

const sections = [
  {
    title: 'Catalogue',
    items: [
      { label: 'Products', to: '/products' },
      { label: 'Suppliers', to: '/suppliers' },
      { label: 'Media', to: '/media' },
    ],
  },
  {
    title: 'Taxonomy',
    items: [
      { label: 'Categories', to: '/taxonomy/categories' },
      { label: 'Spec attributes', to: '/taxonomy/spec-attributes' },
    ],
  },
  {
    title: 'System',
    items: [{ label: 'Settings', to: '/settings' }],
  },
]
</script>

<template>
  <div class="shell">
    <header class="masthead">
      <span class="wordmark">Forge Kivu Admin</span>
      <span v-if="user" class="muted account">{{ user.email }}</span>
      <UiButton @click="logout">Log out</UiButton>
    </header>

    <div class="body">
      <nav class="sidebar">
        <div v-for="section in sections" :key="section.title" class="group">
          <span class="eyebrow group-title">{{ section.title }}</span>
          <NuxtLink
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            class="nav-link"
            active-class="is-active"
          >
            {{ item.label }}
          </NuxtLink>
        </div>
      </nav>

      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.masthead {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-6) var(--space-11);
  border-bottom: var(--border-hairline) solid var(--color-rule-strong);
}

.wordmark {
  flex-grow: 1;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.account {
  font-size: var(--text-xs);
}

.body {
  display: flex;
  align-items: stretch;
  flex-grow: 1;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
  flex-shrink: 0;
  width: 13rem;
  padding: var(--space-10) var(--space-8);
  border-right: var(--border-hairline) solid var(--color-rule);
}

.group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.group-title {
  padding: 0 var(--space-4) var(--space-2);
}

.nav-link {
  padding: var(--space-3) var(--space-4);
  border: var(--border-hairline) solid transparent;
  color: var(--color-ink);
  font-size: var(--text-sm);
  text-decoration: none;
}

.nav-link:hover {
  background: var(--color-canvas);
}

.nav-link.is-active {
  background: var(--color-ink);
  color: var(--color-paper);
  font-weight: var(--weight-medium);
}

.content {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
  flex-grow: 1;
  min-width: 0;
  padding: var(--space-10) var(--space-11) var(--space-12);
}
</style>
