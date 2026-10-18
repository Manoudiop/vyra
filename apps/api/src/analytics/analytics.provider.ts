import { type AnalyticsEventName } from '@vyra/shared';

export interface TrackedEvent {
  name: AnalyticsEventName;
  /** The account the event belongs to; null for anonymous events. */
  userId: string | null;
  /** Already validated against the event's schema: enums, booleans, counts only. */
  properties: Record<string, unknown>;
  occurredAt: Date;
}

/**
 * Where product events go. The MVP ships `MockAnalyticsProvider` (structured
 * log + the AnalyticsEvent table that feeds the admin metrics); PostHog or
 * Segment can plug in here without touching the call sites.
 */
export abstract class AnalyticsProvider {
  abstract readonly name: string;
  abstract track(event: TrackedEvent): Promise<void>;
}
