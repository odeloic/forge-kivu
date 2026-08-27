<script setup lang="ts">
definePageMeta({ access: 'guest', layout: false })

const route = useRoute()
const { login } = useSession()

const email = ref('')
const password = ref('')
const error = ref<ErrorCode | null>(null)
const pending = ref(false)

const submit = async () => {
  if (pending.value) return
  pending.value = true
  error.value = null
  try {
    await login(email.value, password.value)
    await navigateTo(safeRedirect(route.query.redirect))
  } catch (cause) {
    error.value = toErrorCode(cause)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <main class="screen">
    <div class="column">
      <form class="panel" novalidate @submit.prevent="submit">
        <fieldset class="form" :disabled="pending">
          <div class="masthead">
            <h1>Forge Kivu Admin</h1>
            <div class="rule" />
            <p class="eyebrow">Sign in</p>
          </div>

          <div class="fields">
            <div class="field">
              <Label for="email">Email</Label>
              <input
                id="email"
                v-model="email"
                type="email"
                name="email"
                autocomplete="username"
                required
              />
            </div>

            <div class="field">
              <Label for="password">Password</Label>
              <input
                id="password"
                v-model="password"
                type="password"
                name="password"
                autocomplete="current-password"
                required
              />
            </div>
          </div>

          <p v-if="error" class="error status-bad" role="alert">
            {{ errorMessage(error) }}
          </p>

          <button type="submit" class="button-primary submit">
            {{ pending ? 'Signing in…' : 'Sign in' }}
          </button>
        </fieldset>
      </form>
    </div>
  </main>
</template>

<style scoped>
.screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-12);
  background: var(--color-canvas);
}

.column {
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
  width: 22.5rem;
}

.panel {
  padding: var(--space-11) var(--space-11) var(--space-12);
  border: var(--border-hairline) solid var(--color-rule-strong);
  background: var(--color-paper);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
  margin: 0;
  padding: 0;
  border: 0;
}

.masthead {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.rule {
  height: var(--border-hairline);
  background: var(--color-rule-strong);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.error {
  padding: var(--space-4) var(--space-5);
  border: var(--border-hairline) solid var(--color-status-bad);
  font-size: var(--text-xs);
}

.submit {
  width: 100%;
  padding: var(--space-4) var(--space-7);
  font-size: var(--text-sm);
}

.footnote {
  font-size: var(--text-xs);
}
</style>
