import type {
  ProductDetail,
  ProductListItem,
  ProductVariant,
  ProjectDetail,
  ProjectListItem,
  ProjectSpace,
  Space,
} from '@forge-kivu/api-client'
import {
  calculateLineTotal,
  PROJECT_LIMITS,
  type ErrorCode,
} from '@forge-kivu/types'

export type AddToProjectTarget = {
  product: ProductListItem | ProductDetail
  variant?: ProductVariant
}

export type SpaceChoice =
  | { kind: 'none' }
  | { kind: 'existing'; id: string }
  | { kind: 'new'; name: string; canonicalId: string | null }

export type AddToProjectPhase =
  'signed-out' | 'loading' | 'no-projects' | 'variant' | 'edit' | 'done'

const isDetail = (
  product: ProductListItem | ProductDetail,
): product is ProductDetail => 'variants' in product

export const useAddToProject = (
  target: MaybeRefOrGetter<AddToProjectTarget | null>,
) => {
  const api = useApi()
  const { isAuthenticated } = useSession()
  const {
    list: listProjects,
    detail: loadProject,
    setItem,
    createSpace,
  } = useProjects()
  const { list: listSpaces } = useSpaces()
  const memory = useLastUsedProject()

  const phase = ref<AddToProjectPhase>('loading')
  const detail = ref<ProductDetail | null>(null)
  const variant = ref<ProductVariant | null>(null)
  const projects = ref<ProjectListItem[]>([])
  const project = ref<ProjectDetail | null>(null)
  const space = ref<SpaceChoice>({ kind: 'none' })
  const suggestions = ref<Space[]>([])
  const quantity = ref('1')
  const spaceError = ref<ErrorCode | null>(null)
  const error = ref<ErrorCode | null>(null)
  const pending = ref(false)

  let suggestionsLoaded = false

  const loadDetail = async (
    product: ProductListItem,
  ): Promise<ProductDetail> => {
    const res = await api.catalogue.products[':supplierSlug'][
      ':productSlug'
    ].$get({
      param: {
        supplierSlug: product.supplier.slug,
        productSlug: product.slug,
      },
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const spaceId = computed(() =>
    space.value.kind === 'existing' ? space.value.id : null,
  )

  const spaceName = computed(() => {
    if (space.value.kind === 'new') return space.value.name.trim()
    const id = spaceId.value
    if (id === null) return null
    return project.value?.spaces.find((row) => row.id === id)?.name ?? null
  })

  const existing = computed(() => {
    const chosen = variant.value
    const loaded = project.value
    if (!chosen || !loaded || space.value.kind === 'new') return null
    return findLine(loaded.items, chosen.id, spaceId.value)
  })

  const quantityValue = computed(() => Number(quantity.value))

  const quantityValid = computed(() => {
    const value = quantityValue.value
    if (quantity.value.trim() === '' || !Number.isFinite(value)) return false
    if (value < 0.01 || value > PROJECT_LIMITS.quantity) return false
    return Math.round(value * 100) === value * 100
  })

  const lineTotal = computed(() => {
    const price = variant.value?.price ?? null
    if (price === null || !quantityValid.value) return null
    return calculateLineTotal(price, quantityValue.value)
  })

  const nameValid = computed(
    () => space.value.kind !== 'new' || space.value.name.trim().length > 0,
  )

  const submittable = computed(
    () =>
      !pending.value &&
      project.value !== null &&
      variant.value !== null &&
      quantityValid.value &&
      nameValid.value,
  )

  /** FIXME: probably not smart passing this as a literal string */
  const openProjectPath = computed(
    () => `/workshop/projects/${project.value?.id ?? ''}?tab=boq`,
  )

  const signInPath = computed(() => {
    const chosen = toValue(target)
    if (!chosen) return '/login'
    const { supplier, slug } = chosen.product
    return `/login?redirect=/products/${supplier.slug}/${slug}?add=${chosen.variant?.id ?? ''}`
  })

  const spaceFor = (loaded: ProjectDetail): SpaceChoice => {
    const remembered = memory.spaceFor(loaded.id)
    if (remembered === null) return { kind: 'none' }
    if (remembered && loaded.spaces.some((row) => row.id === remembered)) {
      return { kind: 'existing', id: remembered }
    }
    const first = loaded.spaces[0]
    return first ? { kind: 'existing', id: first.id } : { kind: 'none' }
  }

  const openProject = async (id: string) => {
    const loaded = await loadProject(id)
    project.value = loaded
    space.value = spaceFor(loaded)
  }

  const start = async () => {
    const chosen = toValue(target)
    if (!chosen) return

    spaceError.value = null
    error.value = null
    quantity.value = '1'
    space.value = { kind: 'none' }
    project.value = null
    detail.value = isDetail(chosen.product) ? chosen.product : null
    variant.value = chosen.variant ?? null

    if (!isAuthenticated.value) {
      phase.value = 'signed-out'
      return
    }

    phase.value = 'loading'

    try {
      const [loaded, rows] = await Promise.all([
        isDetail(chosen.product)
          ? Promise.resolve(chosen.product)
          : loadDetail(chosen.product),
        listProjects(),
      ])

      detail.value = loaded
      projects.value = rows
      variant.value =
        chosen.variant ??
        (loaded.variants.length === 1 ? loaded.variants[0]! : null)

      if (rows.length === 0) {
        phase.value = 'no-projects'
        return
      }

      const remembered = memory.projectId.value
      const listed = rows.some((row) => row.id === remembered)
      await openProject(listed && remembered ? remembered : rows[0]!.id)

      phase.value = variant.value ? 'edit' : 'variant'
    } catch (cause) {
      error.value = toErrorCode(cause)
    }
  }

  const chooseVariant = (id: string) => {
    variant.value = detail.value?.variants.find((row) => row.id === id) ?? null
  }

  const confirmVariant = () => {
    if (variant.value) phase.value = 'edit'
  }

  const changeProject = async (id: string) => {
    if (pending.value) return
    pending.value = true
    spaceError.value = null
    error.value = null
    try {
      await openProject(id)
    } catch (cause) {
      error.value = toErrorCode(cause)
    } finally {
      pending.value = false
    }
  }

  const chooseSpace = async (choice: SpaceChoice) => {
    spaceError.value = null
    space.value = choice
    if (choice.kind !== 'new' || suggestionsLoaded) return

    suggestionsLoaded = true
    try {
      suggestions.value = await listSpaces()
    } catch {
      suggestionsLoaded = false
    }
  }

  const nameSpace = (name: string, canonicalId: string | null = null) => {
    spaceError.value = null
    space.value = { kind: 'new', name, canonicalId }
  }

  const withCreatedSpace = (
    loaded: ProjectDetail,
    created: ProjectSpace,
  ): ProjectDetail => ({ ...loaded, spaces: [...loaded.spaces, created] })

  const submit = async () => {
    const loaded = project.value
    const chosen = variant.value
    if (!loaded || !chosen || !submittable.value) return

    pending.value = true
    spaceError.value = null
    error.value = null

    let current = loaded
    let targetSpaceId = spaceId.value

    try {
      if (space.value.kind === 'new') {
        const created = await createSpace(current.id, {
          name: space.value.name.trim(),
          spaceId: space.value.canonicalId,
        }).catch((cause: unknown) => {
          spaceError.value = toErrorCode(cause)
          throw cause
        })

        current = withCreatedSpace(current, created)
        project.value = current
        space.value = { kind: 'existing', id: created.id }
        targetSpaceId = created.id
      }

      const saved = await setItem(
        current.id,
        chosen.id,
        quantityValue.value,
        targetSpaceId,
      )

      const key = lineKey({ variantId: chosen.id, spaceId: targetSpaceId })
      project.value = {
        ...current,
        items: [
          ...current.items.filter(
            (item) =>
              lineKey({
                variantId: item.variantId,
                spaceId: item.space?.id ?? null,
              }) !== key,
          ),
          saved,
        ],
      }

      memory.remember(current.id, targetSpaceId)
      phase.value = 'done'
    } catch (cause) {
      if (spaceError.value === null) error.value = toErrorCode(cause)
    } finally {
      pending.value = false
    }
  }

  const addAnother = () => {
    spaceError.value = null
    error.value = null
    phase.value = 'edit'
  }

  return {
    phase,
    detail,
    variant,
    projects,
    project,
    space,
    spaceId,
    spaceName,
    suggestions,
    quantity,
    existing,
    quantityValid,
    lineTotal,
    submittable,
    pending,
    spaceError,
    error,
    openProjectPath,
    signInPath,
    start,
    chooseVariant,
    confirmVariant,
    changeProject,
    chooseSpace,
    nameSpace,
    submit,
    addAnother,
  }
}
