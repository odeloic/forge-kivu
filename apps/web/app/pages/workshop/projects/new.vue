<script setup lang="ts">
import type { Project } from '@forge-kivu/api-client'

definePageMeta({ access: 'authenticated', layout: 'workshop' })

const STEPS = [
  { index: 1, label: 'Identity' },
  { index: 2, label: 'Site & client' },
  { index: 3, label: 'Schedule & budget' },
  { index: 4, label: 'Products' },
  { index: 5, label: 'Review' },
] as const

const { setItem, removeItem } = useProjects()
const { settings, load: loadSettings } = useSettings()

await loadSettings()

const currency = computed(() => settings.value?.currency ?? '')

const project = ref<Project | null>(null)
const step = ref(1)
const done = ref(0)

const lines = ref<ProjectLine[]>([])
const savedLines = ref<ProjectLine[]>([])

const rail = computed(() =>
  STEPS.map((entry) => ({
    ...entry,
    lit: entry.index === step.value || entry.index <= done.value,
    unlocked: entry.index <= done.value + 1,
  })),
)

const advance = () => {
  done.value = Math.max(done.value, step.value)
  step.value = Math.min(STEPS.length, step.value + 1)
}

const goto = (index: number) => {
  if (index <= done.value + 1) step.value = index
}

const saved = (updated: Project) => {
  project.value = updated
  advance()
}

const { pending: acting, error: actionError, run } = useAsyncAction()

const saveProducts = () =>
  run(async () => {
    const current = project.value
    if (!current) return

    const kept = new Set(lines.value.map((line) => line.variantId))
    for (const line of savedLines.value) {
      if (!kept.has(line.variantId))
        await removeItem(current.id, line.variantId)
    }
    for (const line of lines.value) {
      await setItem(current.id, line.variantId, line.quantity)
    }

    savedLines.value = lines.value.map((line) => ({ ...line }))
    advance()
  })

const finish = () => navigateTo(`/workshop/projects/${project.value?.id ?? ''}`)

const nextLabel = computed(() => {
  if (step.value === 1) return 'Create project & continue'
  if (step.value === 2) return 'Save site & continue'
  if (step.value === 3) return 'Save schedule & continue'
  return 'Save products & continue'
})

const title = computed(() => project.value?.name ?? 'New project')

const materials = computed(() => linesTotal(lines.value))
</script>

<template>
  <section class="page">
    <p class="breadcrumb">
      <NuxtLink to="/workshop/projects">Projects</NuxtLink>
      <span class="muted"> / {{ title }}</span>
    </p>

    <div class="header">
      <h1>{{ title }}</h1>
      <span v-if="project" class="flag status-neutral">
        {{ projectTypeLabel(project.projectType) }}
        <template v-if="project.workType">
          · {{ workTypeLabel(project.workType) }}
        </template>
      </span>
      <div class="spacer" />
      <span class="muted counter">Step {{ step }} of {{ STEPS.length }}</span>

      <UiButton v-if="project" as-child variant="ghost">
        <NuxtLink :to="`/workshop/projects/${project.id}`">
          Save &amp; exit
        </NuxtLink>
      </UiButton>

      <UiButton :disabled="step === 1" @click="step -= 1">Back</UiButton>

      <UiButton
        v-if="step === 1"
        type="submit"
        form="wizard-identity"
        variant="primary"
      >
        {{ nextLabel }}
      </UiButton>
      <UiButton
        v-else-if="step === 2"
        type="submit"
        form="wizard-site"
        variant="primary"
      >
        {{ nextLabel }}
      </UiButton>
      <UiButton
        v-else-if="step === 3"
        type="submit"
        form="wizard-schedule"
        variant="primary"
      >
        {{ nextLabel }}
      </UiButton>
      <UiButton
        v-else-if="step === 4"
        variant="primary"
        :disabled="acting"
        @click="saveProducts"
      >
        {{ acting ? 'Saving…' : nextLabel }}
      </UiButton>
      <UiButton v-else variant="primary" @click="finish">
        Open project
      </UiButton>
    </div>

    <ol class="rail">
      <li v-for="entry in rail" :key="entry.index" class="rail-step">
        <button
          type="button"
          class="rail-button"
          :class="{ lit: entry.lit }"
          :disabled="!entry.unlocked"
          @click="goto(entry.index)"
        >
          <span class="rail-label">{{ entry.index }} · {{ entry.label }}</span>
        </button>
      </li>
    </ol>

    <p v-if="actionError" class="note status-bad" role="alert">
      {{ errorMessage(actionError) }}
    </p>

    <ProjectIdentityForm
      v-if="step === 1"
      form-id="wizard-identity"
      :project="project"
      @saved="saved"
    />

    <ProjectSiteForm
      v-else-if="step === 2 && project"
      form-id="wizard-site"
      :project="project"
      @saved="saved"
    />

    <ProjectScheduleForm
      v-else-if="step === 3 && project"
      form-id="wizard-schedule"
      :project="project"
      :currency="currency"
      @saved="saved"
    />

    <ProjectProductPicker
      v-else-if="step === 4"
      v-model="lines"
      :currency="currency"
    />

    <fieldset v-else-if="project" class="section">
      <legend>Review</legend>
      <dl class="review">
        <div class="review-row">
          <dt>Name and type</dt>
          <dd>
            {{ project.name }} · {{ projectTypeLabel(project.projectType) }}
            <template v-if="project.workType">
              · {{ workTypeLabel(project.workType) }}
            </template>
          </dd>
        </div>
        <div class="review-row">
          <dt>Client</dt>
          <dd :class="{ muted: !project.clientName }">
            {{ project.clientName ?? 'Not set' }}
          </dd>
        </div>
        <div class="review-row">
          <dt>Location</dt>
          <dd :class="{ muted: !project.location }">
            {{ project.location ?? 'Not set' }}
          </dd>
        </div>
        <div class="review-row">
          <dt>Dates</dt>
          <dd>{{ formatDateRange(project.startDate, project.endDate) }}</dd>
        </div>
        <div class="review-row">
          <dt>Budget</dt>
          <dd :class="{ muted: project.budget === null }">
            {{
              project.budget === null
                ? 'Not set'
                : `${formatAmount(project.budget)} ${currency}`
            }}
          </dd>
        </div>
        <div class="review-row">
          <dt>Phase</dt>
          <dd :class="{ muted: !project.phase }">
            {{ projectPhaseLabel(project.phase) }}
          </dd>
        </div>
        <div class="review-row">
          <dt>Products</dt>
          <dd :class="{ 'status-warn': lines.length === 0 }">
            {{
              lines.length
                ? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'} · ${formatAmount(materials)} ${currency}`
                : 'None — a bill of quantities needs at least one line'
            }}
          </dd>
        </div>
      </dl>
    </fieldset>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.breadcrumb {
  font-size: var(--text-xs);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-7);
}

.spacer {
  flex-grow: 1;
}

.counter {
  font-size: var(--text-xs);
}

.flag {
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.rail {
  display: flex;
  gap: var(--space-6);
}

.rail-step {
  flex: 1 1 0;
  min-inline-size: 0;
}

.rail-button {
  display: block;
  inline-size: 100%;
  padding: var(--space-5) 0 0;
  border: 0;
  border-block-start: var(--border-hairline) solid var(--color-rule);
  text-align: start;
}

.rail-button.lit {
  border-block-start: 2px solid var(--color-rule-strong);
}

.rail-button:disabled {
  cursor: default;
  opacity: 1;
}

.rail-label {
  display: block;
  color: var(--color-faint);
  font-size: var(--text-3xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-heading);
  text-transform: uppercase;
}

.rail-button.lit .rail-label {
  color: var(--color-ink);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.review {
  display: flex;
  flex-direction: column;
}

.review-row {
  display: flex;
  gap: var(--space-9);
  padding: var(--space-4) 0;
  border-block-end: var(--border-hairline) solid var(--color-rule);
}

.review-row dt {
  flex: none;
  inline-size: 9.5rem;
  color: var(--color-muted);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.review-row dd {
  margin: 0;
  font-size: var(--text-sm);
}
</style>
