import { HttpException, HttpStatus } from '@nestjs/common';
import { type ErrorCode } from '@vyra/shared';

const DEFAULT_STATUS: Record<ErrorCode, HttpStatus> = {
  AUTH_REQUIRED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  LIMIT_REACHED: HttpStatus.PAYMENT_REQUIRED,
  AI_ERROR: HttpStatus.BAD_GATEWAY,
  STORAGE_ERROR: HttpStatus.BAD_GATEWAY,
  CONFLICT: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

/** Business error carrying a stable `ErrorCode` for the client. */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    status: HttpStatus = DEFAULT_STATUS[code],
  ) {
    super(message, status);
  }
}
