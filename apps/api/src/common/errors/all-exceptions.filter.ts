import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiErrorBody, type ErrorCode } from '@vyra/shared';
import { type Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { AppException } from './app.exception';

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'AUTH_REQUIRED',
  [HttpStatus.PAYMENT_REQUIRED]: 'LIMIT_REACHED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'VALIDATION_ERROR',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'VALIDATION_ERROR',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

interface ZodLikeIssue {
  path: PropertyKey[];
  message: string;
}

/**
 * Turns every thrown value into `{ error: { code, message, details? } }`.
 * Unexpected errors are logged with their stack server-side; the client only
 * sees a generic message in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  constructor(private readonly exposeInternalMessages: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toErrorBody(exception);
    response.status(status).json(body);
  }

  toErrorBody(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof AppException) {
      return this.build(
        exception.getStatus(),
        exception.code,
        exception.message,
        exception.details,
      );
    }

    if (exception instanceof ZodValidationException) {
      const issues = (exception.getZodError() as { issues?: ZodLikeIssue[] }).issues ?? [];
      return this.build(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Invalid request', {
        issues: issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code =
        STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR');
      if (status >= 500) this.logUnexpected(exception);
      const message =
        status >= 500 && !this.exposeInternalMessages ? 'Something went wrong' : exception.message;
      return this.build(status, code, message);
    }

    // Prisma known errors (duck-typed to keep this filter free of generated-client imports).
    const prismaCode = (exception as { code?: unknown } | null)?.code;
    if (prismaCode === 'P2002') {
      return this.build(HttpStatus.CONFLICT, 'CONFLICT', 'This resource already exists');
    }
    if (prismaCode === 'P2025') {
      return this.build(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Resource not found');
    }

    this.logUnexpected(exception);
    const message =
      this.exposeInternalMessages && exception instanceof Error
        ? exception.message
        : 'Something went wrong';
    return this.build(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', message);
  }

  private build(
    status: number,
    code: ErrorCode,
    message: string,
    details?: unknown,
  ): { status: number; body: ApiErrorBody } {
    return {
      status,
      body: { error: details === undefined ? { code, message } : { code, message, details } },
    };
  }

  private logUnexpected(exception: unknown): void {
    this.logger.error(
      exception instanceof Error ? exception.message : 'Non-error value thrown',
      exception instanceof Error ? exception.stack : String(exception),
    );
  }
}
