import { Throttle } from '@nestjs/throttler';

const MINUTE = 60_000;

/** THROTTLE_AUTH_LIMIT (validated at boot) overrides limits; read per request so tests can tune it. */
const limit = (fallback: number) => () => {
  const override = Number(process.env.THROTTLE_AUTH_LIMIT);
  return Number.isInteger(override) && override > 0 ? override : fallback;
};

/** Brute-force protection for credential endpoints: 10 attempts / minute / IP. */
export const ThrottleCredentials = () => Throttle({ default: { limit: limit(10), ttl: MINUTE } });

/** Password reset emails and code checks: 5 / 15 minutes / IP. */
export const ThrottlePasswordReset = () =>
  Throttle({ default: { limit: limit(5), ttl: 15 * MINUTE } });
