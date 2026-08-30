<script setup lang="ts">
import type { BoqSummary, ProjectDetail } from '@forge-kivu/api-client'
import { PROJECT_PHASE_VALUES, type ProjectPhase } from '@forge-kivu/types'

const props = defineProps<{
  project: ProjectDetail
  revisions: BoqSummary[]
  currency: string
}>()

const emit = defineEmits<{ changed: [] }>()

const { setPhaseCompletion, clearPhaseCompletion } = useProjects()

const completions = computed(
  () =>
    new Map(props.project.phases.map((row) => [row.phase, row.completedOn])),
)

const rail = computed(() =>
  PROJECT_PHASE_VALUES.map((phase) => {
    const completedOn = completions.value.get(phase) ?? null
    const current = props.project.phase === phase
    return {
      phase,
      label: PROJECT_PHASE_LABELS[phase],
      completedOn,
      lit: completedOn !== null || current,
      state: completedOn
        ? { text: `Done · ${formatMonth(completedOn)}`, tone: 'saved' }
        : current
          ? { text: 'Current', tone: 'editing' }
          : null,
    }
  }),
)

const latest = computed(() => props.revisions[0] ?? null)

const committed = computed(() => latest.value?.total ?? 0)

const budget = computed(() => props.project.budget)

const share = computed(() => {
  const total = budget.value
  if (total === null || total === 0) return null
  return Math.min(1, committed.value / total)
})

const unallocated = computed(() =>
  budget.value === null ? null : budget.value - committed.value,
)

const dates = computed(() => {
  const { startDate, endDate } = props.project
  if (startDate && endDate)
    return `${formatDate(startDate)} → ${formatDate(endDate)}`
  if (startDate) return `From ${formatDate(startDate)}`
  if (endDate) return `Until ${formatDate(endDate)}`
  return 'Not scheduled'
})

const { pending: acting, error: actionError, run } = useAsyncAction()

const today = () => new Date().toISOString().slice(0, 10)

const togglePhase = (phase: ProjectPhase) =>
  run(async () => {
    if (completions.value.has(phase))
      await clearPhaseCompletion(props.project.id, phase)
    else await setPhaseCompletion(props.project.id, phase, today())
    emit('changed')
  })
</script>

<template>
  <div class="tab-body">
    <p v-if="actionError" class="note status-bad" role="alert">
      {{ errorMessage(actionError) }}
    </p>

    <div class="phases">
      <span class="eyebrow">Phase</span>
      <ol class="rail">
        <li v-for="entry in rail" :key="entry.phase" class="rail-step">
          <button
            type="button"
            class="rail-button"
            :class="{ lit: entry.lit }"
            :disabled="acting"
            :title="
              entry.completedOn
                ? `Mark ${entry.label} as not done`
                : `Mark ${entry.label} as done today`
            "
            @click="togglePhase(entry.phase)"
          >
            <span class="rail-label">{{ entry.label }}</span>
            <span
              v-if="entry.state"
              class="rail-state"
              :class="`state-${entry.state.tone}`"
            >
              {{ entry.state.text }}
            </span>
          </button>
        </li>
      </ol>
    </div>

    <div class="columns">
      <div class="column">
        <h2>Project</h2>
        <dl class="facts">
          <div class="fact">
            <dt>Client</dt>
            <dd :class="{ muted: !project.clientName }">
              {{ project.clientName ?? 'Not set' }}
            </dd>
          </div>
          <div class="fact">
            <dt>Location</dt>
            <dd :class="{ muted: !project.location }">
              {{ project.location ?? 'Not set' }}
            </dd>
          </div>
          <div class="fact">
            <dt>Dates</dt>
            <dd>{{ dates }}</dd>
          </div>
          <div class="fact">
            <dt>Budget</dt>
            <dd :class="{ muted: budget === null }">
              {{
                budget === null
                  ? 'Not set'
                  : `${formatAmount(budget)} ${currency}`
              }}
            </dd>
          </div>
          <div class="fact">
            <dt>Description</dt>
            <dd class="muted description">
              {{ project.description ?? 'No description.' }}
            </dd>
          </div>
        </dl>
      </div>

      <div class="column">
        <h2>Budget against materials</h2>

        <div class="meter">
          <div class="meter-head">
            <span class="eyebrow">
              {{
                latest ? `Committed · revision ${latest.revision}` : 'Committed'
              }}
            </span>
            <div class="spacer" />
            <span class="meter-value">{{ formatAmount(committed) }}</span>
            <span v-if="share !== null" class="muted meter-share">
              {{ formatPercent(share) }}
            </span>
          </div>

          <div class="bar">
            <div
              class="bar-fill"
              :style="{ inlineSize: `${(share ?? 0) * 100}%` }"
            />
          </div>

          <div class="meter-foot">
            <span class="muted meter-note">
              {{
                unallocated === null
                  ? 'No budget set'
                  : `Unallocated ${formatAmount(unallocated)}`
              }}
            </span>
            <div class="spacer" />
            <span v-if="budget !== null" class="muted meter-note">
              Budget {{ formatAmount(budget) }} {{ currency }}
            </span>
          </div>
        </div>

        <div class="revisions">
          <span class="eyebrow">Bills of quantities</span>
          <ul v-if="revisions.length" class="revision-list">
            <li
              v-for="(row, index) in revisions"
              :key="row.id"
              class="revision"
            >
              <NuxtLink
                class="revision-link"
                :to="{ query: { tab: 'boqs', revision: row.id } }"
              >
                Revision {{ row.revision }}
              </NuxtLink>
              <span class="muted revision-meta">
                {{ formatDate(row.createdAt) }} · {{ row.lineCount }}
                {{ row.lineCount === 1 ? 'line' : 'lines' }}
              </span>
              <div class="spacer" />
              <span class="num">{{ formatAmount(row.total) }}</span>
              <span v-if="index === 0" class="flag status-ok revision-flag">
                Current
              </span>
              <span v-else class="revision-flag" />
            </li>
          </ul>
          <p v-else class="muted">
            No revision yet. Generate one once the products are set.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.phases {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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

.rail-state {
  display: block;
  margin-block-start: var(--space-1);
  color: var(--color-faint);
  font-size: var(--text-2xs);
  font-weight: var(--weight-regular);
}

.rail-state.state-editing {
  color: var(--color-ink);
}

.rail-state.state-saved {
  color: var(--color-status-ok);
}

.columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-12);
  align-items: start;
}

.column {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
  min-inline-size: 0;
}

.facts {
  display: flex;
  flex-direction: column;
}

.fact {
  display: flex;
  gap: var(--space-9);
  padding: var(--space-4) 0;
  border-block-end: var(--border-hairline) solid var(--color-rule);
}

.fact dt {
  flex: none;
  inline-size: 9.5rem;
  color: var(--color-muted);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.fact dd {
  margin: 0;
  min-inline-size: 0;
}

.description {
  font-size: var(--text-xs);
  text-wrap: pretty;
}

.meter {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.meter-head,
.meter-foot {
  display: flex;
  align-items: baseline;
  gap: var(--space-6);
}

.spacer {
  flex-grow: 1;
}

.meter-value {
  font-family: var(--font-mono);
  font-size: var(--text-md);
  font-variant-numeric: tabular-nums;
}

.meter-share,
.meter-note {
  font-size: var(--text-2xs);
}

.bar {
  position: relative;
  block-size: var(--space-7);
  background: var(--color-canvas);
  border-block-end: var(--border-hairline) solid var(--color-rule-strong);
}

.bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--color-accent);
}

.revisions {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-block-start: var(--space-2);
}

.revision-list {
  display: flex;
  flex-direction: column;
}

.revision {
  display: flex;
  align-items: baseline;
  gap: var(--space-6);
  padding: var(--space-4) 0;
  border-block-end: var(--border-hairline) solid var(--color-rule);
}

.revision-link {
  inline-size: 6rem;
  flex: none;
}

.revision-meta {
  font-size: var(--text-xs);
}

.num {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.revision-flag {
  inline-size: 4.5rem;
  text-align: end;
}

.flag {
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}
</style>
