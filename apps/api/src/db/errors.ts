const PG_UNIQUE_VIOLATION = ['23505']
const PG_FOREIGN_KEY_VIOLATION = ['23503', '23001']

type PgError = { code: unknown; constraint_name?: unknown }

const findPgError = (error: unknown, codes: string[]): PgError | null => {
  if (typeof error !== 'object' || error === null) return null
  if ('code' in error && codes.some((code) => code === error.code)) return error
  return 'cause' in error ? findPgError(error.cause, codes) : null
}

export const isUniqueViolation = (error: unknown): boolean =>
  findPgError(error, PG_UNIQUE_VIOLATION) !== null

export const isForeignKeyViolation = (error: unknown): boolean =>
  findPgError(error, PG_FOREIGN_KEY_VIOLATION) !== null

export const uniqueViolationConstraint = (error: unknown): string | null => {
  const name = findPgError(error, PG_UNIQUE_VIOLATION)?.constraint_name
  return typeof name === 'string' ? name : null
}
