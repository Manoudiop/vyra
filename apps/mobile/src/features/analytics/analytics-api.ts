import { type ClientAnalyticsEvent } from '@vyra/shared';
import { authorizedRequest } from '@/lib/authorized-request';

/**
 * The app reports only what the server cannot see (the paywall being shown);
 * everything else is recorded server-side. Fire-and-forget: a failure is
 * ignored and never reaches the user. The server drops it if they opted out.
 */
export const analyticsApi = {
  track: (event: ClientAnalyticsEvent) =>
    authorizedRequest<void>('/analytics/events', { method: 'POST', body: event }).catch(
      () => undefined,
    ),
};
