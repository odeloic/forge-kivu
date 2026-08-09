export const errorCodes = {
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_TOKEN: 400,
  UPLOAD_INCOMPLETE: 400,
  SIZE_MISMATCH: 400,
  EMAIL_TAKEN: 409,
  INTERNAL: 500,
} as const

export type ErrorCode = keyof typeof errorCodes

export type ErrorResponse = {
  error: {
    code: ErrorCode
    message: string
    requestId?: string
  }
}

export const makeErrorResponse = (
  code: ErrorCode,
  message: string,
  requestId?: string,
): ErrorResponse => ({ error: { code, message, requestId } })
