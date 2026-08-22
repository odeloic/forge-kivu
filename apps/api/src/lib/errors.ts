import { HTTPException } from 'hono/http-exception'

import { errorCodes, type ErrorCode } from '@forge-kivu/types'

export class AppError extends HTTPException {
  readonly code: ErrorCode

  constructor(code: ErrorCode) {
    super(errorCodes[code], { message: code })
    this.code = code
  }
}
