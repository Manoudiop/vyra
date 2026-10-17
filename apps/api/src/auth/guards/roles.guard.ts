import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Role } from '@vyra/shared';
import { AppException } from '../../common/errors/app.exception';
import { type AuthenticatedRequest, ROLES_KEY } from '../decorators';

/** Global guard, runs after JwtAuthGuard: enforces @Roles() when present. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || !roles.includes(user.role)) {
      throw new AppException('FORBIDDEN', 'You do not have access to this resource');
    }
    return true;
  }
}
