import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { TokenService } from '../token.service';

/**
 * Rate limits per signed-in user, per IP otherwise.
 *
 * Mobile carriers in West Africa put many subscribers behind one public IP
 * (carrier-grade NAT): per-IP limits on signed-in features would let one
 * person's usage block strangers. A request with a *valid* access token is
 * tracked by its user; anonymous requests (login, register, reset) keep the
 * per-IP brute-force protection. The guard still runs before authentication.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly tokens: TokenService,
  ) {
    super(options, storage, reflector);
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const header = (req.headers as Record<string, unknown> | undefined)?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      try {
        const payload = await this.tokens.verifyAccessToken(header.slice('Bearer '.length));
        return `user:${payload.sub}`;
      } catch {
        // Invalid or expired token: fall back to the IP, like any anonymous request.
      }
    }
    return super.getTracker(req);
  }
}
