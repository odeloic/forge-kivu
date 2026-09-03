import { z } from 'zod'

export const ATTRIBUTE_VALUE_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  RANGE: 'range',
  COLOR: 'color',
} as const

export type AttributeValueType =
  (typeof ATTRIBUTE_VALUE_TYPES)[keyof typeof ATTRIBUTE_VALUE_TYPES]

export const ATTRIBUTE_VALUE_TYPE_VALUES = [
  ATTRIBUTE_VALUE_TYPES.TEXT,
  ATTRIBUTE_VALUE_TYPES.NUMBER,
  ATTRIBUTE_VALUE_TYPES.BOOLEAN,
  ATTRIBUTE_VALUE_TYPES.RANGE,
  ATTRIBUTE_VALUE_TYPES.COLOR,
] as const

export const OPTION_VALUE_TYPE_VALUES = [
  ATTRIBUTE_VALUE_TYPES.TEXT,
  ATTRIBUTE_VALUE_TYPES.NUMBER,
  ATTRIBUTE_VALUE_TYPES.COLOR,
] as const

export type OptionValueType = (typeof OPTION_VALUE_TYPE_VALUES)[number]

export const HEX_PATTERN = /^#[0-9a-f]{6}$/i

export const hexSchema = z
  .string()
  .trim()
  .regex(HEX_PATTERN, 'Use a #rrggbb colour.')
  .transform((value) => value.toLowerCase())
