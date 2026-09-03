/**
 * FIXME: Refactor Highly suspicious
 */
import type { AdminProductDetail, Unit } from '@forge-kivu/api-client'
import {
  ATTRIBUTE_VALUE_TYPES,
  setOptionsSchema,
  setSpecsSchema,
  type SetOptionsInput,
  type SetSpecsInput,
  variantsFormSchema,
  type VariantsFormValues,
} from '@forge-kivu/types'

export type OptionDraft = { name: string; values: string }

export type VariantDraft = {
  key: string
  optionValueIds: string[]
  labels: string[]
  sku: string
  price: string | number
  unitId: string
  imageMediaId: string | null
}

const DEFAULT_UNIT_SLUG = 'piece'

export type SpecDraft = { attributeId: string; value: string }

export type MediaDraft = { mediaId: string; url: string }

const splitValues = (values: string): string[] =>
  values
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

const combinationKey = (ids: string[]): string => [...ids].sort().join('|')

const buildCombinations = (
  options: AdminProductDetail['options'],
): string[][] => {
  const usable = options.filter((option) => option.values.length > 0)
  if (usable.length === 0) return [[]]

  return usable.reduce<string[][]>(
    (rows, option) =>
      rows.flatMap((row) => option.values.map((value) => [...row, value.id])),
    [[]],
  )
}

export const useProductSections = (
  product: Ref<AdminProductDetail | null | undefined>,
  save: {
    options: (input: SetOptionsInput) => Promise<void>
    variants: (input: VariantsFormValues) => Promise<void>
    specs: (input: SetSpecsInput) => Promise<void>
    media: (input: { mediaIds: string[] }) => Promise<void>
  },
  units: Ref<Unit[] | null | undefined>,
) => {
  const options = ref<OptionDraft[]>([])
  const variants = ref<VariantDraft[]>([])
  const specs = ref<SpecDraft[]>([])
  const media = ref<MediaDraft[]>([])
  const issue = ref<string | null>(null)

  const saved = computed(() => product.value ?? null)

  const labelById = computed(() => {
    const labels = new Map<string, string>()
    for (const option of saved.value?.options ?? []) {
      for (const value of option.values) labels.set(value.id, value.value)
    }
    return labels
  })

  const optionNames = computed(() =>
    (saved.value?.options ?? [])
      .filter((option) => option.values.length > 0)
      .map((option) => option.name),
  )

  const resetOptions = () => {
    options.value = (saved.value?.options ?? []).map((option) => ({
      name: option.name,
      values: option.values.map((value) => value.value).join(', '),
    }))
  }

  const defaultUnitId = computed(
    () =>
      (units.value ?? []).find((unit) => unit.slug === DEFAULT_UNIT_SLUG)?.id ??
      '',
  )

  const resetVariants = () => {
    const existing = new Map(
      (saved.value?.variants ?? []).map((variant) => [
        combinationKey(variant.optionValueIds),
        variant,
      ]),
    )

    variants.value = buildCombinations(saved.value?.options ?? []).map(
      (ids) => {
        const match = existing.get(combinationKey(ids))
        return {
          key: combinationKey(ids),
          optionValueIds: ids,
          labels: ids.map((id) => labelById.value.get(id) ?? ''),
          sku: match?.sku ?? '',
          price:
            match?.price === null || match?.price === undefined
              ? ''
              : String(match.price),
          unitId: match?.unit.id ?? defaultUnitId.value,
          imageMediaId: match?.imageMediaId ?? null,
        }
      },
    )
  }

  const resetSpecs = () => {
    specs.value = (saved.value?.specs ?? []).map((spec) => ({
      attributeId: spec.attributeId,
      value: spec.value,
    }))
  }

  const resetMedia = () => {
    media.value = (saved.value?.media ?? []).map((item) => ({
      mediaId: item.mediaId,
      url: item.url,
    }))
  }

  const resetAll = () => {
    resetOptions()
    resetVariants()
    resetSpecs()
    resetMedia()
    issue.value = null
  }

  watch(product, resetAll, { immediate: true })
  watch(units, resetVariants)

  const saveOptions = async () => {
    issue.value = null
    const payload = {
      options: options.value
        .filter((option) => option.name.trim() !== '')
        .map((option) => ({
          name: option.name,
          type: ATTRIBUTE_VALUE_TYPES.TEXT,
          values: splitValues(option.values).map((value) => ({ value })),
        })),
    }

    const parsed = setOptionsSchema.safeParse(payload)
    if (!parsed.success) {
      issue.value = parsed.error.issues[0]?.message ?? 'Check the option rows.'
      return false
    }

    await save.options(parsed.data)
    return true
  }

  const saveVariants = async () => {
    issue.value = null

    const parsed = variantsFormSchema.safeParse({ variants: variants.value })
    if (!parsed.success) {
      issue.value = parsed.error.issues[0]?.message ?? 'Check the variant rows.'
      return false
    }

    await save.variants(parsed.data)
    return true
  }

  const saveSpecs = async () => {
    issue.value = null
    const payload = {
      specs: specs.value.filter((spec) => spec.attributeId !== ''),
    }

    const parsed = setSpecsSchema.safeParse(payload)
    if (!parsed.success) {
      issue.value = parsed.error.issues[0]?.message ?? 'Check the spec rows.'
      return false
    }

    await save.specs(parsed.data)
    return true
  }

  const saveMedia = async () => {
    issue.value = null
    await save.media({ mediaIds: media.value.map((item) => item.mediaId) })
    return true
  }

  const addOption = () => options.value.push({ name: '', values: '' })
  const removeOption = (index: number) => options.value.splice(index, 1)
  const addMedia = (mediaId: string, url: string) => {
    if (media.value.some((item) => item.mediaId === mediaId)) return
    media.value.push({ mediaId, url })
  }

  const addSpec = () => specs.value.push({ attributeId: '', value: '' })
  const removeSpec = (index: number) => specs.value.splice(index, 1)
  const removeMedia = (index: number) => media.value.splice(index, 1)

  const moveMedia = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= media.value.length) return
    const [item] = media.value.splice(index, 1)
    if (item) media.value.splice(target, 0, item)
  }

  return {
    options,
    variants,
    specs,
    media,
    issue,
    optionNames,
    resetAll,
    saveOptions,
    saveVariants,
    saveSpecs,
    saveMedia,
    addOption,
    addMedia,
    removeOption,
    addSpec,
    removeSpec,
    removeMedia,
    moveMedia,
  }
}
