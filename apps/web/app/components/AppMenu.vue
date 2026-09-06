<script setup lang="ts">
import type { MenuItem } from '../utils/menu'
import type AppMenuColumn from './AppMenuColumn.vue'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ closed: [] }>()
const route = useRoute()
const router = useRouter()
const { user, isAuthenticated, logout } = useSession()
const { cache, errors, pending, load, preload } = useMenuTree()
const visible = computed(() =>
  PRIMARY_NAV.filter((entry) =>
    canAccess(resolveAccess(router.resolve(entry.path)), user.value),
  ),
)
const mobile = useMenuViewport()
const mobileDepth = ref(-1)
const mobilePanel = useTemplateRef('mobilePanel')
const selected = ref<string | null>(null)
const selection = ref<string[]>([])
const spine = useTemplateRef('spine')
const columnRefs =
  useTemplateRef<InstanceType<typeof AppMenuColumn>[]>('columns')
const columns = computed(() =>
  menuColumns(cache.value[selected.value ?? ''] ?? [], selection.value),
)
const failed = computed(() => Boolean(errors.value[selected.value ?? '']))
const selectSection = (path: string) => {
  selected.value = path
  selection.value = []
  mobileDepth.value = path in MENU_ENDPOINTS ? 0 : -1
  void load(path)
}
const pick = async (item: MenuItem, depth: number) => {
  if (item.children?.length) {
    selection.value = [...selection.value.slice(0, depth), item.id]
    mobileDepth.value = depth + 1
  } else {
    await navigateTo(item.target)
    open.value = false
  }
}
const move = async (
  direction: 'left' | 'right',
  item: MenuItem,
  depth: number,
) => {
  if (direction === 'left') {
    if (depth === 0)
      spine.value
        ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
        ?.focus()
    else columnRefs.value?.[depth - 1]?.focus(selection.value[depth - 1])
  } else if (item.children?.length) {
    await pick(item, depth)
    await nextTick()
    columnRefs.value?.[depth + 1]?.focus()
  }
}
const spineKeydown = async (
  event: KeyboardEvent,
  path: string,
  index: number,
) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const buttons = spine.value?.querySelectorAll<HTMLButtonElement>('button')
    buttons?.[
      (index + (event.key === 'ArrowDown' ? 1 : -1) + visible.value.length) %
        visible.value.length
    ]?.focus()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    selectSection(path)
    await load(path)
    await nextTick()
    columnRefs.value?.[0]?.focus()
  }
}
const mobileTitle = computed(() =>
  mobileDepth.value > 0
    ? (columns.value[mobileDepth.value - 1]?.find(
        (item) => item.id === selection.value[mobileDepth.value - 1],
      )?.label ?? '')
    : (visible.value.find((entry) => entry.path === selected.value)?.label ??
      ''),
)
const back = () => {
  mobileDepth.value--
  selection.value = selection.value.slice(0, Math.max(0, mobileDepth.value))
}
watch(mobile, (value) => {
  if (value) mobileDepth.value = columns.value.length - 1
})
const focusSpine = (event: Event) => {
  event.preventDefault()
  if (mobile.value) mobilePanel.value?.focus()
  else spine.value?.querySelector('button')?.focus()
}
const closeFocus = (event: Event) => {
  event.preventDefault()
  emit('closed')
}
watch(open, (value) => {
  if (!value) return
  selected.value =
    activeNavPath(visible.value, route.path) ??
    (route.path === '/' && route.query.category ? '/products' : null)
  selection.value = []
  mobileDepth.value =
    selected.value && selected.value in MENU_ENDPOINTS ? 0 : -1
  void preload()
})
watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="backdrop" />
      <DialogContent
        class="menu"
        :aria-describedby="undefined"
        @open-auto-focus="focusSpine"
        @close-auto-focus="closeFocus"
      >
        <DialogTitle class="sr-only">Main navigation</DialogTitle>
        <slot />
        <div class="body">
          <AppMenuMobile
            v-if="mobile"
            ref="mobilePanel"
            :entries="visible"
            :selected="selected"
            :items="columns[mobileDepth] ?? []"
            :depth="mobileDepth"
            :title="mobileTitle"
            :error="failed"
            :loading="Boolean(pending[selected ?? ''])"
            @section="selectSection"
            @pick="pick($event, mobileDepth)"
            @back="back"
            @retry="selected && load(selected)"
          />
          <nav v-else ref="spine" class="spine" aria-label="Public sections">
            <button
              v-for="(entry, index) in visible"
              :key="entry.path"
              type="button"
              :aria-pressed="selected === entry.path"
              @click="selectSection(entry.path)"
              @keydown="spineKeydown($event, entry.path, index)"
            >
              {{ entry.label }}
            </button>
          </nav>
          <div class="details">
            <div v-if="!mobile" class="levels">
              <TransitionGroup name="column">
                <AppMenuColumn
                  v-for="(items, depth) in columns"
                  :key="`${selected}-${depth}-${depth ? selection[depth - 1] : ''}`"
                  ref="columns"
                  :items="items"
                  :active="selection[depth]"
                  :label="`${visible.find((entry) => entry.path === selected)?.label} level ${depth + 1}`"
                  @pick="pick($event, depth)"
                  @move="(direction, item) => move(direction, item, depth)"
                />
                <AppMenuColumn
                  v-if="failed"
                  key="error"
                  :items="[]"
                  error
                  label="Loading error"
                />
              </TransitionGroup>
            </div>
            <div class="utility">
              <template v-if="isAuthenticated">
                <span class="email">{{ user?.email }}</span>
                <button type="button" @click="logout()">Log out</button>
              </template>
              <NuxtLink v-else to="/login" @click="open = false"
                >Log in</NuxtLink
              >
              <NuxtLink to="/contact" @click="open = false">Contact</NuxtLink>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: var(--color-paper);
}
.menu {
  position: fixed;
  inset: 0;
  z-index: 41;
  display: flex;
  flex-direction: column;
  background: var(--color-paper);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--color-paper);
}
.menu[data-state='open'] .body {
  animation: drop 420ms cubic-bezier(0.77, 0, 0.18, 1);
}
.menu[data-state='closed'] {
  animation: hold 420ms;
}
.menu[data-state='closed'] .body {
  animation: drop 420ms cubic-bezier(0.77, 0, 0.18, 1) reverse;
}
.menu :deep(.header) {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}
.spine {
  display: flex;
  flex-direction: column;
  width: 320px;
  flex-shrink: 0;
  border-right: calc(2 * var(--border-hairline)) solid var(--color-rule-strong);
}
.spine button {
  justify-content: flex-end;
  flex: 1;
  min-height: 0;
  padding: 0 var(--space-5);
  border: 0;
  border-bottom: calc(2 * var(--border-hairline)) solid var(--color-rule-strong);
  background: transparent;
  color: var(--color-muted);
  font-size: 1.75rem;
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-heading);
  text-align: right;
  text-transform: uppercase;
  cursor: pointer;
}
.spine button[aria-pressed='true'],
.spine button:hover {
  color: var(--color-ink);
}
.spine button:focus-visible {
  outline: var(--focus-width-strong) solid var(--color-accent);
  outline-offset: calc(-1 * var(--focus-width-strong));
}
.details {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.levels {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
}
.utility {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-12);
  min-height: 64px;
  padding: var(--space-4) var(--space-12);
  border-top: var(--border-hairline) solid var(--color-field-border);
}
.utility a,
.utility button {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-heading);
  text-transform: uppercase;
  text-decoration: none;
  color: var(--color-ink);
  cursor: pointer;
  white-space: nowrap;
}
.email {
  overflow-wrap: anywhere;
  font-size: var(--text-sm);
}
.column-enter-active,
.column-leave-active {
  transition: width 360ms cubic-bezier(0.77, 0, 0.18, 1);
}
.column-enter-from,
.column-leave-to {
  width: 0;
  border-right-width: 0;
}
@keyframes drop {
  from {
    transform: translateY(-100%);
  }
  to {
    transform: translateY(0);
  }
}
@keyframes hold {
  from {
    opacity: 1;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .menu,
  .menu .body {
    animation: none !important;
  }
  .column-enter-active,
  .column-leave-active {
    transition: none;
  }
}
@media (max-width: 63.999rem) {
  .body {
    flex-direction: column;
  }
  .details {
    display: contents;
  }
  .utility {
    flex-shrink: 0;
    padding-bottom: max(var(--space-4), env(safe-area-inset-bottom));
  }
  .spine {
    width: 100%;
  }
  .spine button {
    justify-content: flex-end;
    font-size: var(--text-lg);
  }
  .utility {
    gap: var(--space-8);
    padding-inline: var(--space-8);
    flex-wrap: wrap;
  }
}
</style>
