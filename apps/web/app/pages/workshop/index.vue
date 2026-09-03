<script setup lang="ts">
import { sumAmounts } from '@forge-kivu/types'

definePageMeta({ access: 'authenticated', layout: 'workshop' })

const RECENT_LIMIT = 5

const { list } = useProjects()

const { data, error } = await useAsyncData('workshop-overview', () => list())

const projects = computed(() => data.value ?? [])

const recent = computed(() => projects.value.slice(0, RECENT_LIMIT))

const itemTotal = computed(() =>
  projects.value.reduce((sum, project) => sum + project.itemCount, 0),
)

const budgetTotal = computed(() =>
  sumAmounts(projects.value, (project) => project.budget),
)
</script>

<template>
  <section class="page">
    <div class="header">
      <h1>Workshop</h1>
      <div class="spacer" />
      <UiButton as-child variant="primary">
        <NuxtLink to="/workshop/projects/new">New project</NuxtLink>
      </UiButton>
    </div>

    <p v-if="error" class="note status-bad">
      {{ errorMessage(toErrorCode(error)) }}
    </p>

    <ul class="stats">
      <li class="stat">
        <span class="eyebrow">Projects</span>
        <span class="stat-value">{{ projects.length }}</span>
      </li>
      <li class="stat">
        <span class="eyebrow">Products selected</span>
        <span class="stat-value">{{ itemTotal }}</span>
      </li>
      <li class="stat">
        <span class="eyebrow">Planned budget</span>
        <span class="stat-value">{{ formatAmount(budgetTotal) }}</span>
      </li>
    </ul>

    <div class="section">
      <div class="section-header">
        <h2>Recent projects</h2>
        <div class="spacer" />
        <NuxtLink class="more" to="/workshop/projects">All projects</NuxtLink>
      </div>

      <table v-if="recent.length">
        <thead>
          <tr>
            <th>Project</th>
            <th class="type-column">Type</th>
            <th class="work-column">Work</th>
            <th class="phase-column">Phase</th>
            <th class="items-column">Items</th>
            <th class="budget-column">Budget</th>
            <th class="updated-column">Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="project in recent" :key="project.id">
            <td>
              <div class="named">
                <NuxtLink
                  class="ellip"
                  :to="`/workshop/projects/${project.id}`"
                >
                  {{ project.name }}
                </NuxtLink>
                <code v-if="project.location" class="ellip">
                  {{ project.location }}
                </code>
              </div>
            </td>
            <td>
              <div class="ellip">
                {{ projectTypeLabel(project.projectType) }}
              </div>
            </td>
            <td>
              <div class="ellip">{{ workTypeLabel(project.workType) }}</div>
            </td>
            <td class="flag" :class="projectPhaseClass(project.phase)">
              {{ projectPhaseLabel(project.phase) }}
            </td>
            <td class="num">{{ project.itemCount }}</td>
            <td class="num">
              {{ project.budget === null ? '—' : formatAmount(project.budget) }}
            </td>
            <td class="muted stamp">{{ formatDay(project.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>

      <p v-else-if="!error" class="muted">
        No projects yet. Start one to price its materials.
      </p>
    </div>
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

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-11);
}

.stat {
  border-block-start: 2px solid var(--color-rule-strong);
  padding-block-start: var(--space-5);
}

.stat-value {
  display: block;
  margin-block-start: var(--space-2);
  font-size: var(--text-xl);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-tight);
  font-variant-numeric: tabular-nums;
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.section-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-8);
}

.more {
  font-size: var(--text-xs);
}

.type-column {
  inline-size: 11.5rem;
}

.work-column {
  inline-size: 9.5rem;
}

.phase-column {
  inline-size: 7.5rem;
}

.items-column {
  inline-size: 4.5rem;
  text-align: end;
}

.budget-column {
  inline-size: 9.5rem;
  text-align: end;
}

.updated-column {
  inline-size: 6.5rem;
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

.num {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.stamp {
  font-size: var(--text-xs);
}
</style>
