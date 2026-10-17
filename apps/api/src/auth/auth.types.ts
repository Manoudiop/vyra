import { type Role } from '@vyra/shared';

/** Claims carried by the access token. */
export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

/** The authenticated principal attached to the request by JwtAuthGuard. */
export interface AuthenticatedUser {
  id: string;
  role: Role;
}

export interface RequestContext {
  userAgent?: string;
}
