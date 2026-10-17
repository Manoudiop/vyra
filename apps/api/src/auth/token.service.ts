import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type AuthTokens, type Role } from '@vyra/shared';
import { AppException } from '../common/errors/app.exception';
import { generateOpaqueToken, hmacSha256 } from '../common/security/tokens';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { type AccessTokenPayload } from './auth.types';

const DAY_MS = 24 * 60 * 60 * 1000;

const invalidSession = () =>
  new AppException('AUTH_REQUIRED', 'Your session has expired. Please sign in again.');

/**
 * Short-lived JWT access tokens + opaque rotating refresh tokens.
 *
 * Refresh tokens are stored as keyed hashes and grouped in families (one per
 * sign-in). Each refresh rotates the token; presenting an already-rotated token
 * means it was copied, so the whole family is revoked.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async issue(
    user: { id: string; role: Role },
    userAgent?: string,
    familyId: string = randomUUID(),
  ): Promise<{ tokens: AuthTokens; refreshTokenId: string }> {
    const refreshToken = generateOpaqueToken();
    const refreshTokenExpiresAt = new Date(
      Date.now() + this.config.get('REFRESH_TOKEN_TTL_DAYS') * DAY_MS,
    );
    const row = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        familyId,
        expiresAt: refreshTokenExpiresAt,
        userAgent: userAgent?.slice(0, 255),
      },
      select: { id: true },
    });

    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);

    return {
      refreshTokenId: row.id,
      tokens: {
        accessToken,
        accessTokenExpiresAt: new Date(exp * 1000).toISOString(),
        refreshToken,
        refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
      },
    };
  }

  /** Exchanges a refresh token for a new pair. Throws AUTH_REQUIRED on any problem. */
  async rotate(
    refreshToken: string,
    userAgent?: string,
  ): Promise<{ userId: string; tokens: AuthTokens }> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
      include: { user: { select: { id: true, role: true } } },
    });
    if (!current) throw invalidSession();

    if (current.revokedAt) {
      // Reuse of a rotated/revoked token: assume theft, kill the whole family.
      await this.revokeFamily(current.familyId);
      throw invalidSession();
    }
    if (current.expiresAt <= new Date()) throw invalidSession();

    // Conditional update guards against two concurrent rotations of the same token.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: current.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.revokeFamily(current.familyId);
      throw invalidSession();
    }

    const next = await this.issue(current.user, userAgent, current.familyId);
    await this.prisma.refreshToken.update({
      where: { id: current.id },
      data: { replacedById: next.refreshTokenId },
    });
    return { userId: current.user.id, tokens: next.tokens };
  }

  /** Logout: revokes the session (family) the token belongs to. Idempotent. */
  async revokeByToken(refreshToken: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
      select: { familyId: true },
    });
    if (row) await this.revokeFamily(row.familyId);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      if (typeof payload.sub !== 'string') throw new Error('Missing subject');
      return payload;
    } catch {
      throw new AppException('AUTH_REQUIRED', 'Authentication required');
    }
  }

  private revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hash(token: string): string {
    return hmacSha256(this.config.get('JWT_REFRESH_SECRET'), token);
  }
}
