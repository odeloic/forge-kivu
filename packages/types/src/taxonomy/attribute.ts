import { z } from 'zod'

import { optionalField } from '../fields'
import {
  ATTRIBUTE_VALUE_TYPES,
  ATTRIBUTE_VALUE_TYPE_VALUES,
} from './attribute-values'
import { taxonomyFields } from './base'

export const attributeTypeSchema = z.enum(ATTRIBUTE_VALUE_TYPE_VALUES, {
  error: 'Choose a valid value type.',
})

export const createAttributeSchema = z.object({
  name: taxonomyFields.name,
  slug: taxonomyFields.slug,
  unit: taxonomyFields.unit.nullish(),
  type: attributeTypeSchema.default(ATTRIBUTE_VALUE_TYPES.TEXT),
})

export const updateAttributeSchema = z
  .object({
    name: taxonomyFields.name,
    slug: taxonomyFields.slug,
    unit: taxonomyFields.unit.nullable(),
    type: attributeTypeSchema,
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'At least one field is required',
  })

export const attributeFormSchema = z.object({
  name: taxonomyFields.name,
  slug: taxonomyFields.slug,
  unit: optionalField(taxonomyFields.unit),
  type: attributeTypeSchema,
})

export type CreateAttributeInput = z.infer<typeof createAttributeSchema>
export type UpdateAttributeInput = z.infer<typeof updateAttributeSchema>
export type AttributeFormValues = z.output<typeof attributeFormSchema>
