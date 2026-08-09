import postgres from 'postgres'

const PG_UNIQUE_VIOLATION = ['23505']
const PG_REFERENCE_VIOLATION = ['23503', '23001']

const findPgError = (
  error: unknown,
  codes: string[],
): postgres.PostgresError | null => {
  if (error instanceof postgres.PostgresError) {
    return codes.includes(error.code) ? error : null
  }
  if (typeof error === 'object' && error !== null && 'cause' in error) {
    return findPgError(error.cause, codes)
  }
  return null
}

export const isUniqueViolation = (error: unknown): boolean =>
  findPgError(error, PG_UNIQUE_VIOLATION) !== null

export const isReferenceViolation = (error: unknown): boolean =>
  findPgError(error, PG_REFERENCE_VIOLATION) !== null

export const uniqueViolationConstraint = (error: unknown): string | null =>
  findPgError(error, PG_UNIQUE_VIOLATION)?.constraint_name ?? null
