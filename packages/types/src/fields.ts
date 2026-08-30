import { z } from 'zod'

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const slugSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .pipe(
      z
        .string()
        .max(maxLength)
        .regex(
          SLUG_PATTERN,
          'Use lowercase letters and numbers, separated by single hyphens.',
        ),
    )

export const optionalField = <T extends z.ZodType<unknown, string>>(
  schema: T,
) =>
  z
    .string()
    .transform((value) => (value.trim() === '' ? null : value))
    .pipe(schema.nullable())

export const optionalNumberField = <T extends z.ZodType<unknown, number>>(
  schema: T,
) =>
  z
    .union([z.string(), z.number()])
    .transform((value) =>
      typeof value === 'string' && value.trim() === '' ? null : Number(value),
    )
    .refine((value) => value === null || !Number.isNaN(value), {
      message: 'Enter a number.',
    })
    .pipe(schema.nullable())
