<script setup lang="ts">
interface Props {
  attribute: AttributeFacet
}

const props = defineProps<Props>()

const { specValues, toggleSpec } = useCatalogueFilters()

const selected = computed(() => specValues(props.attribute.slug))
</script>

<template>
  <fieldset class="section">
    <legend>{{ attributeTitle(attribute) }}</legend>
    <div class="options">
      <label
        v-for="value in attribute.values"
        :key="value.value"
        class="choice option"
      >
        <CheckboxRoot
          :model-value="selected.includes(value.value)"
          class="box"
          @update:model-value="toggleSpec(attribute.slug, value.value)"
        >
          <CheckboxIndicator class="tick" />
        </CheckboxRoot>
        <span class="option-label">{{ value.value }}</span>
        <span class="count">{{ value.count }}</span>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.section {
  padding: var(--space-7) 0 0;
  border: 0;
  border-top: var(--border-hairline) solid var(--color-rule);
}

.section legend {
  padding: 0;
}

.options {
  display: flex;
  flex-direction: column;
  padding-top: var(--space-2);
}

.option {
  gap: var(--space-4);
  padding: var(--space-2) 0;
  cursor: pointer;
}

.option:hover .option-label {
  text-decoration: underline;
  text-underline-offset: 0.125rem;
}

.option-label {
  flex-grow: 1;
}

.count {
  color: var(--color-faint);
  font-size: var(--text-2xs);
  font-variant-numeric: tabular-nums;
}

.box {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 0.75rem;
  height: 0.75rem;
  padding: 0;
  border: var(--border-hairline) solid var(--color-control-border);
  background: var(--color-paper);
}

.box[data-state='checked'] {
  border-color: var(--color-ink);
  background: var(--color-ink);
}

.tick {
  width: 0.25rem;
  height: 0.25rem;
  background: var(--color-paper);
}
</style>
