<script setup lang="ts">
const { user, logout } = useSession()

const router = useRouter()
const route = useRoute()

const links = computed(() =>
  WORKSHOP_NAV.filter((entry) =>
    canAccess(resolveAccess(router.resolve(entry.path)), user.value),
  ),
)

const active = computed(() => activeNavPath(links.value, route.path))
</script>

<template>
  <div class="shell">
    <header class="masthead">
      <span class="wordmark">Forge Kivu · Workshop</span>
      <span v-if="user" class="muted account">{{ user.email }}</span>
      <UiButton @click="logout">Log out</UiButton>
    </header>

    <div class="body">
      <nav class="sidebar">
        <div class="group">
          <span class="eyebrow group-title">Workshop</span>
          <NuxtLink
            v-for="entry in links"
            :key="entry.path"
            :to="entry.path"
            class="nav-link"
            :class="{ 'is-active': entry.path === active }"
          >
            {{ entry.label }}
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
  min-block-size: 100vh;
}

.masthead {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-6) var(--space-11);
  border-block-end: var(--border-hairline) solid var(--color-rule-strong);
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
  min-block-size: 0;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
  flex-shrink: 0;
  inline-size: 13rem;
  padding: var(--space-10) var(--space-8);
  border-inline-end: var(--border-hairline) solid var(--color-rule);
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
  min-inline-size: 0;
  padding: var(--space-10) var(--space-11) var(--space-12);
}
</style>
