<script setup lang="ts">
import type { ProjectListItem } from '@forge-kivu/api-client'

interface Props {
  target: AddToProjectTarget | null
}

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<Props>()

const {
  phase,
  detail,
  variant,
  projects,
  project,
  space,
  spaceName,
  suggestions,
  quantity,
  existing,
  lineTotal,
  submittable,
  pending,
  spaceError,
  error,
  openProjectPath,
  signInPath,
  start,
  chooseVariant,
  confirmVariant,
  changeProject,
  chooseSpace,
  nameSpace,
  submit,
  addAnother,
} = useAddToProject(() => props.target)

watch(open, (value) => {
  if (value) void start()
})

const picked = computed<string | null>({
  get: () => variant.value?.id ?? null,
  set: (value) => {
    if (value) chooseVariant(value)
  },
})

const unit = computed(() => variant.value?.unit.symbol ?? '')

const productName = computed(() => detail.value?.name ?? '')

const variantName = computed(() =>
  variant.value && detail.value
    ? variantLabel(variant.value, detail.value.options)
    : '',
)

const projectOption = (row: ProjectListItem): string =>
  row.phase ? `${row.name} · ${projectPhaseLabel(row.phase)}` : row.name

const clashNote = computed(() => {
  const line = existing.value
  if (!line) return null
  return `Already in ${spaceName.value ?? 'the whole project'} — ${line.quantity} ${unit.value}. Adding replaces that quantity; it does not add to it.`
})

const actionLabel = computed(() =>
  existing.value ? 'Update quantity' : 'Add to project',
)

const totalLabel = computed(() =>
  lineTotal.value === null ? '—' : formatRwf(lineTotal.value),
)

const summary = computed(() =>
  [
    project.value?.name,
    spaceName.value,
    `${quantity.value} ${unit.value}`,
    totalLabel.value,
  ]
    .filter(Boolean)
    .join(' · '),
)
</script>

<template>
  <UiDialog v-model:open="open" title="Add to project">
    <p v-if="phase === 'signed-out'" class="muted lead">
      Projects live in your workshop. Sign in to add
      {{ productName || 'this product' }} to one.
    </p>

    <template v-else-if="phase === 'loading'">
      <p v-if="error" class="note status-bad" role="alert">
        {{ errorMessage(error) }}
      </p>
      <p v-else class="muted lead">Loading…</p>
    </template>

    <p v-else-if="phase === 'no-projects'" class="muted lead">
      No projects yet. Start one and this product goes straight into it.
    </p>

    <template v-else-if="phase === 'variant'">
      <p class="muted lead">{{ productName }}</p>
      <AddToProjectVariantList
        v-if="detail"
        v-model="picked"
        :variants="detail.variants"
        :options="detail.options"
      />
    </template>

    <template v-else-if="phase === 'edit'">
      <div class="product">
        <span class="name">{{ productName }}</span>
        <span v-if="variantName" class="muted variant">{{ variantName }}</span>
      </div>

      <div class="field">
        <Label for="add-project">Project</Label>
        <select
          id="add-project"
          :value="project?.id ?? ''"
          :disabled="pending"
          @change="changeProject(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="row in projects" :key="row.id" :value="row.id">
            {{ projectOption(row) }}
          </option>
        </select>
      </div>

      <AddToProjectSpaceField
        :space="space"
        :spaces="project?.spaces ?? []"
        :suggestions="suggestions"
        :error="spaceError"
        @choose="chooseSpace"
        @name="nameSpace"
      />

      <ProjectQuantityField v-model="quantity" :unit="unit" />

      <p class="total">
        <span class="eyebrow">Line total</span>
        <span class="total-value">{{ totalLabel }}</span>
      </p>

      <p v-if="clashNote" class="note status-warn">{{ clashNote }}</p>

      <p v-if="error" class="note status-bad" role="alert">
        {{ errorMessage(error) }}
      </p>
    </template>

    <template v-else>
      <p class="lead">Added.</p>
      <p class="muted summary">{{ summary }}</p>
    </template>

    <div class="actions">
      <template v-if="phase === 'signed-out'">
        <UiButton as-child variant="primary">
          <NuxtLink :to="signInPath">Sign in</NuxtLink>
        </UiButton>
      </template>

      <template v-else-if="phase === 'no-projects'">
        <UiButton as-child variant="primary">
          <NuxtLink to="/workshop/projects/new">New project</NuxtLink>
        </UiButton>
      </template>

      <template v-else-if="phase === 'variant'">
        <UiButton
          :disabled="!variant"
          variant="primary"
          @click="confirmVariant"
        >
          Continue
        </UiButton>
      </template>

      <template v-else-if="phase === 'edit'">
        <UiButton :disabled="!submittable" variant="primary" @click="submit">
          {{ pending ? 'Saving…' : actionLabel }}
        </UiButton>
      </template>

      <template v-else-if="phase === 'done'">
        <UiButton @click="addAnother">Add to another space</UiButton>
        <UiButton as-child variant="primary">
          <NuxtLink :to="openProjectPath">Open project</NuxtLink>
        </UiButton>
      </template>
    </div>
  </UiDialog>
</template>

<style scoped>
.lead {
  font-size: var(--text-sm);
}

.product {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-inline-size: 0;
}

.name {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.variant {
  font-size: var(--text-xs);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-inline-size: 0;
}

.total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-6);
  border-block-start: 2px solid var(--color-rule-strong);
  padding-block-start: var(--space-4);
}

.total-value {
  font-family: var(--font-mono);
  font-size: var(--text-md);
  font-variant-numeric: tabular-nums;
}

.summary {
  font-size: var(--text-xs);
}

.note {
  font-size: var(--text-xs);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-4);
}

@media (max-width: 56.25rem) {
  .actions {
    flex-direction: column-reverse;
  }

  .actions :deep(> *) {
    inline-size: 100%;
    min-block-size: 2.75rem;
  }
}
</style>
