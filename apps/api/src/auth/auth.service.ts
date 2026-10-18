import { Injectable } from '@nestjs/common';
import {
  type AuthSession,
  type AuthTokens,
  type LoginInput,
  type RegisterInput,
} from '@vyra/shared';
import { AppException } from '../common/errors/app.exception';
import { hashPassword, verifyPassword } from '../common/security/password';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { TokenService } from './token.service';

const invalidCredentials = () => new AppException('AUTH_REQUIRED', 'Incorrect email or password.');

@Injectable()
export class AuthService {
  /** Hash of a random password, verified when the email is unknown so timing does not leak accounts. */
  private readonly dummyHash: Promise<string> = hashPassword(`dummy-${Math.random()}`);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly analytics: AnalyticsService,
  ) {}

  async register(input: RegisterInput, userAgent?: string): Promise<AuthSession> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new AppException('CONFLICT', 'An account already exists with this email.');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        // Every account starts with an empty profile, preferences and a FREE plan.
        profile: { create: {} },
        stylePreference: { create: {} },
        subscription: { create: { plan: 'FREE', status: 'ACTIVE', provider: 'mock' } },
      },
      select: { id: true, role: true },
    });

    this.analytics.track(user.id, 'signup', {});
    return this.session(user, userAgent);
  }

  async login(input: LoginInput, userAgent?: string): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, role: true, passwordHash: true },
    });
    if (!user) {
      await verifyPassword(await this.dummyHash, input.password);
      throw invalidCredentials();
    }
    if (!(await verifyPassword(user.passwordHash, input.password))) throw invalidCredentials();

    return this.session(user, userAgent);
  }

  refresh(refreshToken: string, userAgent?: string): Promise<{ tokens: AuthTokens }> {
    return this.tokens.rotate(refreshToken, userAgent).then(({ tokens }) => ({ tokens }));
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revokeByToken(refreshToken);
  }

  private async session(
    user: { id: string; role: 'USER' | 'ADMIN' },
    userAgent?: string,
  ): Promise<AuthSession> {
    const [{ tokens }, authUser] = await Promise.all([
      this.tokens.issue(user, userAgent),
      this.users.getAuthUser(user.id),
    ]);
    return { user: authUser, tokens };
  }
}
