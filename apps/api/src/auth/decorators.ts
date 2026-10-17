import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import { type Role } from '@vyra/shared';
import { type Request } from 'express';
import { type AuthenticatedUser } from './auth.types';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

/** Opts a route out of the global JWT guard. Everything else requires a valid access token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the given roles (checked after authentication). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };

/** Injects the authenticated user. Ownership checks must always use this id, never a body field. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
