const PG_UNIQUE_VIOLATION = '23505'
const PG_FOREIGN_KEY_VIOLATION = '23503'

const hasPgCode = (error: unknown, code: string): boolean => {
  if (typeof error !== 'object' || error === null) return false
  if ('code' in error && error.code === code) return true
  return 'cause' in error && hasPgCode(error.cause, code)
}

export const isUniqueViolation = (error: unknown): boolean =>
  hasPgCode(error, PG_UNIQUE_VIOLATION)

export const isForeignKeyViolation = (error: unknown): boolean =>
  hasPgCode(error, PG_FOREIGN_KEY_VIOLATION)
