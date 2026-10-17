// Type-only package: every export must be erasable (`export type`), so it can be
// imported from any runtime (Node, Metro, Next.js) without a build step.
// Domain contracts are added here as each module lands.

export type {
  ApiErrorBody,
  ClothingCategory,
  ErrorCode,
  GenderPreference,
  HealthResponse,
  Occasion,
  Plan,
  PlanFeature,
  Season,
  Style,
  UsageMetric,
} from '@vyra/shared';

/** Cursor-paginated list response used by list endpoints. */
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

/** ISO-8601 date-time string as serialized by the API. */
export type IsoDateTime = string;

/** `YYYY-MM-DD` calendar date, timezone-free. */
export type IsoDate = string;
