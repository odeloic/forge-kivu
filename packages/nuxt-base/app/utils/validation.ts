type PathSegment = PropertyKey | { readonly key: PropertyKey }

type StandardIssue = {
  readonly message: string
  readonly path?: ReadonlyArray<PathSegment>
}

type StandardResult<TOutput> =
  | { readonly value: TOutput; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<StandardIssue> }

export type StandardSchema<TInput, TOutput> = {
  readonly '~standard': {
    readonly validate: (
      value: unknown,
    ) => StandardResult<TOutput> | Promise<StandardResult<TOutput>>
  }
  readonly _zod?: { readonly input?: TInput }
}

export type TypedSchema<TInput, TOutput> = {
  __type: 'VVTypedSchema'
  parse: (values: TInput) => Promise<{
    value?: TOutput
    errors: { path?: string; errors: string[] }[]
  }>
}

const keyOf = (segment: PathSegment): PropertyKey =>
  typeof segment === 'object' && segment !== null && 'key' in segment
    ? segment.key
    : segment

const toPath = (segments: ReadonlyArray<PathSegment>): string =>
  segments.reduce<string>((path, segment) => {
    const key = keyOf(segment)
    if (typeof key === 'number') return `${path}[${key}]`
    if (!path) return String(key)
    return `${path}.${String(key)}`
  }, '')

export const toTypedSchema = <TInput, TOutput>(
  schema: StandardSchema<TInput, TOutput>,
): TypedSchema<TInput, TOutput> => ({
  __type: 'VVTypedSchema',
  async parse(values) {
    const result = await schema['~standard'].validate(values)
    if (!result.issues) return { value: result.value, errors: [] }

    const byPath = new Map<string, string[]>()
    for (const issue of result.issues) {
      const path = toPath(issue.path ?? [])
      const messages = byPath.get(path)
      if (messages) messages.push(issue.message)
      else byPath.set(path, [issue.message])
    }

    return {
      errors: [...byPath].map(([path, errors]) => ({ path, errors })),
    }
  },
})
