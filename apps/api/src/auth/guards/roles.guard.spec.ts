import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../common/errors/app.exception';
import { type AuthenticatedUser } from '../auth.types';
import { RolesGuard } from './roles.guard';

function contextFor(user: AuthenticatedUser | undefined, roles?: string[]) {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { guard: new RolesGuard(reflector), context };
}

describe('RolesGuard', () => {
  it('lets through routes without @Roles', () => {
    const { guard, context } = contextFor({ id: 'u', role: 'USER' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a matching role', () => {
    const { guard, context } = contextFor({ id: 'u', role: 'ADMIN' }, ['ADMIN']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('forbids other roles with FORBIDDEN', () => {
    const { guard, context } = contextFor({ id: 'u', role: 'USER' }, ['ADMIN']);
    expect(() => guard.canActivate(context)).toThrow(AppException);
    try {
      guard.canActivate(context);
    } catch (error) {
      expect((error as AppException).code).toBe('FORBIDDEN');
    }
  });
});
