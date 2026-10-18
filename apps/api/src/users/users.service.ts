import { Injectable, Logger } from '@nestjs/common';
import { type AuthUser } from '@vyra/shared';
import { AppException } from '../common/errors/app.exception';
import { verifyPassword } from '../common/security/password';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Deletes the account and everything in it (right to erasure; also required
   * by the app stores). The database cascade removes closet, outfits, history,
   * subscription, usage, analytics events and sessions; then the photos go.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new AppException('AUTH_REQUIRED', 'Authentication required');
    if (!(await verifyPassword(user.passwordHash, password))) {
      // Not AUTH_REQUIRED: the session is fine, only the confirmation failed.
      throw new AppException('FORBIDDEN', 'Wrong password.', { reason: 'WRONG_PASSWORD' });
    }
    await this.prisma.user.delete({ where: { id: userId } });
    try {
      await this.storage.deleteUserFolder(userId);
    } catch (error) {
      // The account is gone; leftover files are unreachable (no key points to
      // them) and the error is logged for cleanup.
      this.logger.error(
        `Photos of deleted account ${userId} not removed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

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
