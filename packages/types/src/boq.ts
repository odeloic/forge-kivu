import { z } from 'zod'

import { ATTRIBUTE_VALUE_TYPE_VALUES, hexSchema } from './taxonomy'

export const boqOptionSchema = z.object({
  name: z.string(),
  type: z.enum(ATTRIBUTE_VALUE_TYPE_VALUES),
  value: z.string(),
  hex: hexSchema.nullable(),
})

export type BoqOption = z.infer<typeof boqOptionSchema>

export const EXPORT_FORMATS = {
  XLSX: 'xlsx',
  CSV: 'csv',
} as const

export type ExportFormat = (typeof EXPORT_FORMATS)[keyof typeof EXPORT_FORMATS]

export const EXPORT_FORMAT_VALUES = [
  EXPORT_FORMATS.XLSX,
  EXPORT_FORMATS.CSV,
] as const

export const BOQ_VIEWS = {
  GALLERY: 'gallery',
  BOQ: 'boq',
} as const

export type BoqView = (typeof BOQ_VIEWS)[keyof typeof BOQ_VIEWS]

export const BOQ_VIEW_VALUES = [BOQ_VIEWS.GALLERY, BOQ_VIEWS.BOQ] as const

export const BOQ_COLUMNS = [
  'name',
  'sku',
  'supplier',
  'category',
  'space',
  'unit',
  'options',
  'unitPrice',
  'quantity',
  'lineTotal',
] as const

export type BoqColumn = (typeof BOQ_COLUMNS)[number]

export const BOQ_LOCKED_COLUMNS = [
  'name',
  'lineTotal',
] as const satisfies readonly BoqColumn[]

export const BOQ_GROUPS = ['space', 'supplier', 'category', 'color'] as const

export type BoqGroup = (typeof BOQ_GROUPS)[number]

export const BOQ_SORT_FIELDS = [
  'sortOrder',
  'name',
  'supplier',
  'category',
  'space',
  'unitPrice',
  'quantity',
  'lineTotal',
] as const

export type BoqSortField = (typeof BOQ_SORT_FIELDS)[number]

export const SORT_DIRECTIONS = ['asc', 'desc'] as const

export type SortDirection = (typeof SORT_DIRECTIONS)[number]

export type BoqSort = { field: BoqSortField; direction: SortDirection }

export const BOQ_DEFAULT_SORT: BoqSort = {
  field: 'sortOrder',
  direction: 'asc',
}

const LOCKED = new Set<BoqColumn>(BOQ_LOCKED_COLUMNS)

const columnsSchema = z
  .string()
  .transform((value) => value.split(',').map((part) => part.trim()))
  .pipe(z.array(z.enum(BOQ_COLUMNS)))

const sortSchema = z
  .string()
  .regex(/^[a-zA-Z]+:(asc|desc)$/, 'Use field:asc or field:desc.')
  .transform((value) => {
    const [field, direction] = value.split(':')
    return { field, direction }
  })
  .pipe(
    z.object({
      field: z.enum(BOQ_SORT_FIELDS),
      direction: z.enum(SORT_DIRECTIONS),
    }),
  )

export const boqViewQueryShape = {
  view: z.enum(BOQ_VIEW_VALUES).catch(BOQ_VIEWS.GALLERY),
  columns: columnsSchema.optional(),
  groupBy: z.enum(BOQ_GROUPS).optional(),
  sort: sortSchema.optional(),
}

export type BoqViewQuery = {
  view: BoqView
  columns: BoqColumn[]
  groupBy: BoqGroup | null
  sort: BoqSort
}

const normaliseView = (input: {
  view: BoqView
  columns?: BoqColumn[]
  groupBy?: BoqGroup
  sort?: BoqSort
}): BoqViewQuery => {
  const selected = new Set<BoqColumn>(input.columns ?? BOQ_COLUMNS)
  return {
    view: input.view,
    columns: BOQ_COLUMNS.filter(
      (column) => selected.has(column) || LOCKED.has(column),
    ),
    groupBy: input.groupBy ?? null,
    sort: input.sort ?? BOQ_DEFAULT_SORT,
  }
}

export const boqViewQuerySchema = z
  .object(boqViewQueryShape)
  .transform(normaliseView)

export const exportQuerySchema = z
  .object({ ...boqViewQueryShape, format: z.enum(EXPORT_FORMAT_VALUES) })
  .transform(({ format, ...view }) => ({ ...normaliseView(view), format }))

export type ExportQuery = z.infer<typeof exportQuerySchema>

export const BOQ_DEFAULT_VIEW: BoqViewQuery = boqViewQuerySchema.parse({})

export type BoqLineView = {
  name: string
  sku: string | null
  supplierName: string
  categoryName: string
  spaceName: string | null
  unit: string
  options: BoqOption[]
  unitPrice: number
  quantity: number
  sortOrder: number
}
