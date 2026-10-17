import { z } from 'zod';

/** Machine-readable error codes returned by every API error response. */
export const ERROR_CODES = [
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'LIMIT_REACHED',
  'AI_ERROR',
  'STORAGE_ERROR',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** Shape of every error body: `{ error: { code, message, details? } }`. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return apiErrorSchema.safeParse(value).success;
}
