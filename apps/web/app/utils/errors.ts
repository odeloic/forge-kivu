import {
  errorCodes,
  errorResponseSchema,
  type ErrorCode,
} from '@forge-kivu/types'

import type { NuxtError } from '#app'

export type { ErrorCode } from '@forge-kivu/types'

const messages: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Your session has expired.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  FORBIDDEN: 'You do not have access to this page.',
  NOT_FOUND: 'This page does not exist.',
  INVALID_TOKEN: 'This link is invalid or has expired.',
  UPLOAD_INCOMPLETE: 'The upload did not finish.',
  SIZE_MISMATCH: 'The uploaded file does not match the expected size.',
  MEDIA_NOT_READY: 'This media is still being processed.',
  PARENT_NOT_FOUND: 'The selected parent does not exist.',
  PARENT_CYCLE: 'An item cannot be its own ancestor.',
  SUPPLIER_NOT_FOUND: 'The selected supplier does not exist.',
  CATEGORY_NOT_FOUND: 'The selected category does not exist.',
  ATTRIBUTE_NOT_FOUND: 'The selected attribute does not exist.',
  OPTION_VALUE_NOT_FOUND: 'The selected option value does not exist.',
  VARIANT_INCOMPLETE: 'This variant is missing required options.',
  VARIANT_DUPLICATE: 'A variant with these options already exists.',
  PRODUCT_NOT_PUBLISHED: 'This product is not published.',
  BOQ_NOT_GENERATABLE: 'This bill of quantities cannot be generated yet.',
  EMAIL_TAKEN: 'Email already registered.',
  SLUG_TAKEN: 'That slug is already in use.',
  NAME_TAKEN: 'That name is already in use.',
  SUPPLIER_IN_USE: 'This supplier is still in use.',
  CATEGORY_IN_USE: 'This category is still in use.',
  ATTRIBUTE_IN_USE: 'This attribute is still in use.',
  VARIANT_IN_USE: 'This variant is still in use.',
  INTERNAL: 'Something went wrong.',
}

const statusFallbacks: Record<number, ErrorCode> = {
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
}

export class WebError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code)
    this.name = 'WebError'
  }
}

export const toWebError = async (res: Response): Promise<WebError> => {
  const body: unknown = await res.json().catch(() => null)
  const parsed = errorResponseSchema.safeParse(body)
  const code = parsed.success
    ? parsed.data.error.code
    : statusFallbacks[res.status]
  return new WebError(code ?? 'INTERNAL')
}

export const toWebErrorCode = (cause: unknown): ErrorCode =>
  cause instanceof WebError ? cause.code : 'INTERNAL'

export const createWebError = (code: ErrorCode): NuxtError =>
  createError({ statusCode: errorCodes[code], data: { code } })

export const nuxtWebErrorCode = (error: NuxtError): ErrorCode => {
  const code = (error.data as { code?: unknown } | undefined)?.code
  if (typeof code === 'string' && code in messages) return code as ErrorCode
  return statusFallbacks[error.statusCode ?? 0] ?? 'INTERNAL'
}

export const errorMessage = (code: ErrorCode): string => messages[code]
