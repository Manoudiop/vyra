import { Injectable } from '@nestjs/common';
import { type AuthUser } from '@vyra/shared';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        profile: { select: { onboardingCompletedAt: true } },
      },
    });
    // A valid token for a deleted account behaves like no token at all.
    if (!user) throw new AppException('AUTH_REQUIRED', 'Authentication required');

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      // Signed avatar URLs arrive with StorageService (phase 7).
      avatarUrl: null,
      role: user.role,
      onboardingCompleted: user.profile?.onboardingCompletedAt != null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
