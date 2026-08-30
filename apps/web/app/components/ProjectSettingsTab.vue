<script setup lang="ts">
import type { ProjectDetail } from '@forge-kivu/api-client'

const props = defineProps<{
  project: ProjectDetail
  currency: string
}>()

const emit = defineEmits<{ changed: [] }>()

const key = computed(() => props.project.updatedAt)
</script>

<template>
  <div class="tab-body">
    <ProjectIdentityForm
      :key="`identity-${key}`"
      form-id="project-identity"
      :project="project"
      @saved="emit('changed')"
    >
      <template #default="{ saving }">
        <div class="actions">
          <UiButton type="submit" variant="primary" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save identity' }}
          </UiButton>
        </div>
      </template>
    </ProjectIdentityForm>

    <ProjectSiteForm
      :key="`site-${key}`"
      form-id="project-site"
      :project="project"
      @saved="emit('changed')"
    >
      <template #default="{ saving }">
        <div class="actions">
          <UiButton type="submit" variant="primary" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save site & client' }}
          </UiButton>
        </div>
      </template>
    </ProjectSiteForm>

    <ProjectScheduleForm
      :key="`schedule-${key}`"
      form-id="project-schedule"
      :project="project"
      :currency="currency"
      @saved="emit('changed')"
    >
      <template #default="{ saving }">
        <div class="actions">
          <UiButton type="submit" variant="primary" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save schedule & budget' }}
          </UiButton>
        </div>
      </template>
    </ProjectScheduleForm>
  </div>
</template>

<style scoped>
.tab-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}
</style>
