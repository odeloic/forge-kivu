<script setup lang="ts">
import { useForm } from 'vee-validate'

import type { AdminSupplierDetail } from '@forge-kivu/api-client'
import { SUPPLIER_LIMITS, supplierProfileFormSchema } from '@forge-kivu/types'

const props = defineProps<{ supplier: AdminSupplierDetail }>()
const emit = defineEmits<{ saved: [] }>()

const { update } = useSuppliers()

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: supplierProfileFormSchema,
  initialValues: {
    name: props.supplier.name,
    slug: props.supplier.slug,
    description: props.supplier.description ?? '',
    email: props.supplier.email ?? '',
    phone: props.supplier.phone ?? '',
    websiteUrl: props.supplier.websiteUrl ?? '',
    address: props.supplier.address ?? '',
  },
})

const [name, nameAttrs] = defineField('name')
const [slug, slugAttrs] = defineField('slug')
const [description, descriptionAttrs] = defineField('description')
const [email, emailAttrs] = defineField('email')
const [phone, phoneAttrs] = defineField('phone')
const [websiteUrl, websiteUrlAttrs] = defineField('websiteUrl')
const [address, addressAttrs] = defineField('address')

const { pending: saving, error, run } = useAsyncAction()

const submit = handleSubmit((values) => {
  if (saving.value) return
  return run(async () => {
    const saved = await update(props.supplier.id, values)
    if (saved.slug === props.supplier.slug) emit('saved')
    else await navigateTo(`/suppliers/${saved.slug}`)
  })
})
</script>

<template>
  <form class="form" novalidate @submit="submit">
    <fieldset class="fields" :disabled="saving">
      <legend>Identity</legend>

      <div class="row">
        <div class="field">
          <Label for="profile-name">Name</Label>
          <input
            id="profile-name"
            v-model="name"
            v-bind="nameAttrs"
            type="text"
            :maxlength="SUPPLIER_LIMITS.name"
          />
          <span v-if="errors.name" class="hint status-bad">
            {{ errors.name }}
          </span>
        </div>
        <div class="field">
          <Label for="profile-slug">Slug</Label>
          <input
            id="profile-slug"
            v-model="slug"
            v-bind="slugAttrs"
            type="text"
            :maxlength="SUPPLIER_LIMITS.slug"
          />
          <span v-if="errors.slug" class="hint status-bad">
            {{ errors.slug }}
          </span>
        </div>
      </div>

      <div class="field">
        <Label for="profile-description">Description</Label>
        <textarea
          id="profile-description"
          v-model="description"
          v-bind="descriptionAttrs"
          rows="3"
          :maxlength="SUPPLIER_LIMITS.description"
        />
        <span v-if="errors.description" class="hint status-bad">
          {{ errors.description }}
        </span>
      </div>
    </fieldset>

    <fieldset class="fields" :disabled="saving">
      <legend>Contact</legend>

      <div class="row">
        <div class="field">
          <Label for="profile-email">Email</Label>
          <input
            id="profile-email"
            v-model="email"
            v-bind="emailAttrs"
            type="email"
            :maxlength="SUPPLIER_LIMITS.email"
          />
          <span v-if="errors.email" class="hint status-bad">
            {{ errors.email }}
          </span>
        </div>
        <div class="field">
          <Label for="profile-phone">Phone</Label>
          <input
            id="profile-phone"
            v-model="phone"
            v-bind="phoneAttrs"
            type="tel"
            :maxlength="SUPPLIER_LIMITS.phone"
          />
          <span v-if="errors.phone" class="hint status-bad">
            {{ errors.phone }}
          </span>
        </div>
      </div>

      <div class="field">
        <Label for="profile-website">Website</Label>
        <input
          id="profile-website"
          v-model="websiteUrl"
          v-bind="websiteUrlAttrs"
          type="url"
          :maxlength="SUPPLIER_LIMITS.url"
          placeholder="https://"
        />
        <span v-if="errors.websiteUrl" class="hint status-bad">
          {{ errors.websiteUrl }}
        </span>
      </div>

      <div class="field">
        <Label for="profile-address">Address</Label>
        <textarea
          id="profile-address"
          v-model="address"
          v-bind="addressAttrs"
          rows="2"
          :maxlength="SUPPLIER_LIMITS.address"
        />
        <span v-if="errors.address" class="hint status-bad">
          {{ errors.address }}
        </span>
        <span class="hint">
          One free-form address. Every contact field is optional.
        </span>
      </div>
    </fieldset>

    <p v-if="error" class="note status-bad" role="alert">
      {{ errorMessage(error) }}
    </p>

    <div class="actions">
      <UiButton type="submit" variant="primary" :disabled="saving">
        {{ saving ? 'Saving…' : 'Save profile' }}
      </UiButton>
      <span class="muted">
        Identity and contact details save together. Images save as soon as you
        replace them.
      </span>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.row {
  display: flex;
  gap: var(--space-7);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex-grow: 1;
  min-inline-size: 0;
}

.hint {
  color: var(--color-faint);
  font-size: var(--text-2xs);
}

.hint.status-bad {
  color: var(--color-status-bad);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-7);
  font-size: var(--text-xs);
}
</style>
