export const errorCodes = {
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_TOKEN: 400,
  UPLOAD_INCOMPLETE: 400,
  SIZE_MISMATCH: 400,
  MEDIA_NOT_READY: 400,
  PARENT_NOT_FOUND: 400,
  PARENT_CYCLE: 400,
  SUPPLIER_NOT_FOUND: 400,
  CATEGORY_NOT_FOUND: 400,
  ATTRIBUTE_NOT_FOUND: 400,
  OPTION_VALUE_NOT_FOUND: 400,
  VARIANT_INCOMPLETE: 400,
  VARIANT_DUPLICATE: 400,
  PRODUCT_NOT_PUBLISHED: 400,
  BOQ_NOT_GENERATABLE: 422,
  EMAIL_TAKEN: 409,
  SLUG_TAKEN: 409,
  NAME_TAKEN: 409,
  SUPPLIER_IN_USE: 409,
  CATEGORY_IN_USE: 409,
  ATTRIBUTE_IN_USE: 409,
  VARIANT_IN_USE: 409,
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
