---
name: vue-components
description: How to write a good Vue component - SFC.
when_to_use: Use when you have to write a new vue component or refactoring a vue component.
---

When writing code for a new vue SFC, use this skill as a reference on how to write a nice vue component for this project.

## RULES

### Basics (Housekeeping)
- Use semantic component names
- Organize by feature as the application grows

### IMPORTANT: Don't put too much business logic in the component
Instead of something like this:

```tsx
<script setup>
// API calls
// validation
// transformation
// permissions
// caching
// 150 lines of state management
</script>
```
Extract Reusable logic

```tsx
const {
  users,
  isLoading,
  updateUser,
} = useUsers()
```
Rule of thumb:

```md
.vue component
    ↓
presentation + interaction

composable
    ↓
reusable UI/application logic

service/API layer
    ↓
external communication
```


### Keep the component focused
A component should ideally have one clear responsibility.

```md
BAD
UserDashboard.vue
- fetches users
- handles filters
- edits users
- manages pagination
- renders charts
- handles permissions
```

```md
GOOD
UserDashboard.vue
├── UserFilters.vue
├── UserTable.vue
├── UserEditDialog.vue
└── UserStats.vue
```

### Use a consistent SFC order
```tsx
<script setup lang="ts">
</script>

<template>
</template>

<style scoped>
</style>
```

### Keep props explicit and typed

```tsx
interface Props {
  user: User
  editable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  editable: false,
})
```

### Treat emits like part of the component API

```tsx
const emit = defineEmits<{
  save: [user: User]
  cancel: []
}>()
```

### Computed state over duplicate state

```tsx
// VERY BAD
const firstName = ref('')
const lastName = ref('')
const fullName = ref('')

watch([firstName, lastName], () => {
  fullName.value = `${firstName.value} ${lastName.value}`
})

// GOOD 
const fullName = computed(
  () => `${firstName.value} ${lastName.value}`
)
```

### Avoid unnecessary watches

```md
computed → derive data
event handler → react to user actions
watch → react to side effects
```

watch() shouldn't be your default state-management mechanism.
