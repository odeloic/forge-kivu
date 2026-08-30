<script setup lang="ts">
import {
  PROJECT_SORTS,
  type ProjectPhase,
  type ProjectSort,
  type ProjectType,
} from '@forge-kivu/types'

definePageMeta({ access: 'authenticated', layout: 'workshop' })

const SORT_LABELS: Record<ProjectSort, string> = {
  [PROJECT_SORTS.UPDATED_AT]: 'Recently updated',
  [PROJECT_SORTS.CREATED_AT]: 'Recently created',
}

const { list } = useProjects()

const projectType = ref('')
const phase = ref('')
const sort = ref<ProjectSort>(PROJECT_SORTS.UPDATED_AT)

const { data, error } = await useAsyncData(
  'workshop-projects',
  () =>
    list({
      ...(projectType.value
        ? { projectType: projectType.value as ProjectType }
        : {}),
      ...(phase.value ? { phase: phase.value as ProjectPhase } : {}),
      sort: sort.value,
    }),
  { watch: [projectType, phase, sort] },
)

const count = computed(() => data.value?.length ?? 0)
</script>

<template>
  <section class="page">
    <div class="header">
      <h1>Projects</h1>
      <div class="spacer" />
      <UiButton as-child variant="primary">
        <NuxtLink to="/workshop/projects/new">New project</NuxtLink>
      </UiButton>
    </div>

    <div class="filters">
      <div class="field">
        <Label for="filter-type">Type</Label>
        <select id="filter-type" v-model="projectType">
          <option value="">All types</option>
          <option
            v-for="option in projectTypeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="field">
        <Label for="filter-phase">Phase</Label>
        <select id="filter-phase" v-model="phase">
          <option value="">All phases</option>
          <option
            v-for="option in projectPhaseOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="field">
        <Label for="filter-sort">Sort</Label>
        <select id="filter-sort" v-model="sort">
          <option
            v-for="(label, value) in SORT_LABELS"
            :key="value"
            :value="value"
          >
            {{ label }}
          </option>
        </select>
      </div>

      <div class="spacer" />
      <span class="muted total">
        {{ count }} {{ count === 1 ? 'project' : 'projects' }}
      </span>
    </div>

    <p v-if="error" class="note status-bad">
      {{ errorMessage(toErrorCode(error)) }}
    </p>

    <table v-if="data?.length">
      <thead>
        <tr>
          <th>Project</th>
          <th class="type-column">Type</th>
          <th class="work-column">Work</th>
          <th class="phase-column">Phase</th>
          <th class="dates-column">Dates</th>
          <th class="items-column">Items</th>
          <th class="budget-column">Budget</th>
          <th class="actions-column">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="project in data" :key="project.id">
          <td>
            <div class="named">
              <NuxtLink class="ellip" :to="`/workshop/projects/${project.id}`">
                {{ project.name }}
              </NuxtLink>
              <code v-if="project.clientName || project.location" class="ellip">
                {{
                  [project.clientName, project.location]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </code>
            </div>
          </td>
          <td>
            <div class="ellip">{{ projectTypeLabel(project.projectType) }}</div>
          </td>
          <td>
            <div class="ellip">{{ workTypeLabel(project.workType) }}</div>
          </td>
          <td class="flag" :class="projectPhaseClass(project.phase)">
            {{ projectPhaseLabel(project.phase) }}
          </td>
          <td class="muted stamp">
            {{ formatDateRange(project.startDate, project.endDate) }}
          </td>
          <td class="num">{{ project.itemCount }}</td>
          <td class="num">
            {{ project.budget === null ? '—' : formatAmount(project.budget) }}
          </td>
          <td>
            <div class="actions">
              <UiButton as-child variant="ghost">
                <NuxtLink :to="`/workshop/projects/${project.id}`">
                  Open
                </NuxtLink>
              </UiButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="!error" class="muted">No project matches these filters.</p>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-7);
}

.spacer {
  flex-grow: 1;
}

.filters {
  display: flex;
  align-items: flex-end;
  gap: var(--space-6);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  inline-size: 13rem;
}

.total {
  font-size: var(--text-xs);
}

.type-column {
  inline-size: 11rem;
}

.work-column {
  inline-size: 9rem;
}

.phase-column {
  inline-size: 7rem;
}

.dates-column {
  inline-size: 9.5rem;
}

.items-column {
  inline-size: 4.5rem;
  text-align: end;
}

.budget-column {
  inline-size: 9rem;
  text-align: end;
}

.actions-column {
  inline-size: 5.5rem;
}

.named {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
}

.ellip {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.flag {
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.stamp {
  font-size: var(--text-xs);
}

.num {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.actions {
  display: flex;
  gap: var(--space-1);
  margin: 0 calc(-1 * var(--space-4));
}
</style>
