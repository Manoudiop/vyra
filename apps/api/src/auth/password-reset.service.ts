import { Inject, Injectable } from '@nestjs/common';
import { PASSWORD_RESET_CODE_LENGTH } from '@vyra/shared';
import { AppException } from '../common/errors/app.exception';
import { hashPassword } from '../common/security/password';
import { generateNumericCode, hmacSha256, safeEqualHex } from '../common/security/tokens';
import { AppConfigService } from '../config/app-config.service';
import { MAIL_PROVIDER, type MailProvider } from '../mail/mail.provider';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';

export const RESET_CODE_TTL_MINUTES = 15;
export const RESET_CODE_MAX_ATTEMPTS = 5;

const invalidCode = () =>
  new AppException('VALIDATION_ERROR', 'This code is invalid or has expired. Request a new one.');

/**
 * Password reset by 6-digit code (typed in the app — no deep link needed).
 * Codes are HMAC-hashed, expire after 15 minutes, allow 5 attempts, and only
 * the most recent code for a user is valid.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly config: AppConfigService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
  ) {}

  /** Always resolves the same way, whether or not the account exists. */
  async request(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, firstName: true },
    });
    if (!user) return;

    const code = generateNumericCode(PASSWORD_RESET_CODE_LENGTH);
    await this.prisma.$transaction([
      // A new code invalidates any previous one.
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          codeHash: this.hash(user.id, code),
          expiresAt: new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60_000),
        },
      }),
    ]);

    await this.mail.send({
      to: email,
      template: 'password-reset',
      subject: 'Ton code VYRA',
      text:
        `Bonjour ${user.firstName},\n\n` +
        `Ton code de réinitialisation VYRA est : ${code}\n` +
        `Il expire dans ${RESET_CODE_TTL_MINUTES} minutes. ` +
        `Si tu n'es pas à l'origine de cette demande, ignore ce message.`,
      data: { code },
    });
  }

  async reset(email: string, code: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw invalidCode();

    const token = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!token || token.attempts >= RESET_CODE_MAX_ATTEMPTS) throw invalidCode();

    if (!safeEqualHex(token.codeHash, this.hash(user.id, code))) {
      const attempts = token.attempts + 1;
      await this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: {
          attempts,
          ...(attempts >= RESET_CODE_MAX_ATTEMPTS ? { usedAt: new Date() } : {}),
        },
      });
      throw invalidCode();
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
    ]);
    // A password change signs out every device.
    await this.tokens.revokeAllForUser(user.id);
  }

  private hash(userId: string, code: string): string {
    // Binding the user id prevents reusing a hash across accounts.
    return hmacSha256(this.config.get('JWT_REFRESH_SECRET'), `${userId}:${code}`);
  }
}
